const { PrismaClient } = require('@prisma/client');

const DB_SIZE_LIMIT_MB = parseInt(process.env.DB_SIZE_LIMIT_MB || '450', 10);
const CHECK_INTERVAL_MS = parseInt(process.env.DB_CHECK_INTERVAL_MS || String(60 * 60 * 1000), 10);
const DB_WARNING_THRESHOLD_MB = Math.floor(DB_SIZE_LIMIT_MB * 0.85); // 85% warning

class DatabaseManager {
  constructor() {
    this.databases = [];
    this.activeIndex = parseInt(process.env.ACTIVE_DB_INDEX || '0', 10);
    this.initialized = false;
    this._fallback = null;
    this.checkTimer = null;
    this._switching = false; // prevent concurrent switches
  }

  getDatabaseUrls() {
    if (process.env.DATABASE_URLS) {
      return process.env.DATABASE_URLS.split(',').map(u => u.trim()).filter(Boolean);
    }
    if (process.env.DATABASE_URL) return [process.env.DATABASE_URL];
    return [];
  }

  createClient(url) {
    return new PrismaClient({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      // Connection pool settings for scalability
      // Prisma uses a connection pool internally; these env vars can tune it:
      // ?connection_limit=10&pool_timeout=30 in the URL
    });
  }

  async initialize() {
    if (this.initialized) return;
    const urls = this.getDatabaseUrls();
    urls.forEach((url, i) => {
      this.databases.push({ index: i, url, client: null, sizeMB: 0, isAvailable: true });
    });
    if (this.databases.length === 0) {
      // Fallback single client
      this._fallback = new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });
      await this._fallback.$connect();
      this.initialized = true;
      return;
    }

    // ensure active client
    await this.getActiveClient();
    this.startSizeMonitor();
    this.initialized = true;
  }

  async getActiveClient() {
    const db = this.databases[this.activeIndex];
    if (!db) {
      if (!this._fallback) {
        this._fallback = new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });
        await this._fallback.$connect();
      }
      return this._fallback;
    }
    if (!db.client) {
      db.client = this.createClient(db.url);
      await db.client.$connect();
    }
    return db.client;
  }

  async checkDatabaseSize(client) {
    try {
      const result = await client.$queryRaw`SELECT pg_database_size(current_database()) as size`;
      const sizeMB = Math.round((Number(result[0].size) / (1024 * 1024)) * 100) / 100;
      return sizeMB;
    } catch (err) {
      return -1;
    }
  }

  async findAvailableDatabase() {
    for (let i = 0; i < this.databases.length; i++) {
      if (i === this.activeIndex) continue;
      const db = this.databases[i];
      if (!db.client) {
        try {
          db.client = this.createClient(db.url);
          await db.client.$connect();
        } catch (e) {
          db.isAvailable = false;
          continue;
        }
      }
      const size = await this.checkDatabaseSize(db.client);
      db.sizeMB = size;
      if (size >= 0 && size < DB_SIZE_LIMIT_MB) return i;
    }
    return -1;
  }

  async switchDatabase(newIndex) {
    if (newIndex < 0 || newIndex >= this.databases.length) throw new Error('Invalid DB index');
    const oldIndex = this.activeIndex;
    this.activeIndex = newIndex;
    process.env.ACTIVE_DB_INDEX = String(newIndex);
    const db = this.databases[newIndex];
    if (!db.client) { db.client = this.createClient(db.url); await db.client.$connect(); }
    console.log(`🔄 [DB ROTATION] Switched from DB #${oldIndex} to DB #${newIndex} (size: ${this.databases[oldIndex]?.sizeMB || '?'}MB → ${db.sizeMB || '?'}MB)`);
    return this.getActiveClient();
  }

  async autoSwitch() {
    if (this._switching) return; // prevent concurrent switches
    this._switching = true;
    try {
      // Update sizes of ALL already-connected databases (fast — sockets already open)
      for (const db of this.databases) {
        if (db.client) {
          const size = await this.checkDatabaseSize(db.client);
          if (size >= 0) db.sizeMB = size;
        }
      }

      const activeDb = this.databases[this.activeIndex];
      const activeSize = activeDb?.sizeMB || 0;

      // Log warning when approaching limit
      if (activeSize >= DB_WARNING_THRESHOLD_MB && activeSize < DB_SIZE_LIMIT_MB) {
        console.warn(`⚠️ [DB WARNING] Active DB #${this.activeIndex} at ${activeSize}MB / ${DB_SIZE_LIMIT_MB}MB (${Math.round(activeSize / DB_SIZE_LIMIT_MB * 100)}%)`);
      }

      // If active DB is at or near limit, find and switch to next available
      if (activeSize >= DB_SIZE_LIMIT_MB) {
        console.log(`🚨 [DB ROTATION] DB #${this.activeIndex} exceeded ${DB_SIZE_LIMIT_MB}MB limit (${activeSize}MB). Looking for next available...`);
        const next = await this.findAvailableDatabase();
        if (next >= 0) {
          await this.switchDatabase(next);
        } else {
          console.error(`❌ [DB ROTATION] No available database found under ${DB_SIZE_LIMIT_MB}MB! All databases may be full.`);
        }
      }
    } catch (e) {
      console.error('❌ [DB ROTATION] autoSwitch error:', e.message);
    } finally {
      this._switching = false;
    }
  }

  // Background: connect to all DBs and populate initial sizes (runs once on startup)
  async refreshAllSizes() {
    console.log(`📊 [DB] Refreshing sizes for ${this.databases.length} databases...`);
    for (const db of this.databases) {
      if (!db.client) {
        try {
          db.client = this.createClient(db.url);
          await db.client.$connect();
        } catch (e) {
          db.isAvailable = false;
          console.warn(`⚠️ [DB] Could not connect to DB #${db.index}: ${e.message}`);
          continue;
        }
      }
      const size = await this.checkDatabaseSize(db.client);
      if (size >= 0) { db.sizeMB = size; db.isAvailable = true; }
    }
    const summary = this.databases.map(d => `DB#${d.index}: ${d.sizeMB}MB ${d.index === this.activeIndex ? '(active)' : ''} ${!d.isAvailable ? '(unavailable)' : ''}`).join(', ');
    console.log(`📊 [DB] Sizes: ${summary}`);
  }

  startSizeMonitor() {
    // Initial refresh: connect all DBs and get real sizes (runs in background)
    setTimeout(() => this.refreshAllSizes().catch(e => console.error('DB refresh error:', e.message)), 3000);
    // First auto-switch check after 10s
    setTimeout(() => this.autoSwitch(), 10000);
    // Regular check every interval
    this.checkTimer = setInterval(() => this.autoSwitch(), CHECK_INTERVAL_MS);
    console.log(`⏱️ [DB] Size monitor started (check every ${Math.round(CHECK_INTERVAL_MS / 60000)}min, limit: ${DB_SIZE_LIMIT_MB}MB, warn at: ${DB_WARNING_THRESHOLD_MB}MB)`);
  }

  async getAllStatus() {
    // Return cached data immediately — don't open new connections to idle databases.
    // Only refresh the currently active DB (already connected, fast).
    const out = [];
    for (const db of this.databases) {
      let sizeMB = db.sizeMB || 0;
      // Only re-query the active database (it's already connected)
      if (db.index === this.activeIndex && db.client) {
        try {
          sizeMB = await this.checkDatabaseSize(db.client);
          db.sizeMB = sizeMB;
        } catch (_) { sizeMB = db.sizeMB || 0; }
      }
      out.push({
        index: db.index,
        sizeMB,
        isActive: db.index === this.activeIndex,
        isAvailable: db.isAvailable,
      });
    }
    return out;
  }

  async disconnectAll() {
    if (this.checkTimer) clearInterval(this.checkTimer);
    for (const db of this.databases) if (db.client) await db.client.$disconnect();
    if (this._fallback) await this._fallback.$disconnect();
  }
}

const dbManager = new DatabaseManager();

// ─── Read methods vs Write methods ───────────────────────────────────────────
const READ_METHODS = new Set([
  'findMany', 'findFirst', 'findUnique',
  'findFirstOrThrow', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy',
]);
const WRITE_METHODS = new Set([
  'create', 'createMany', 'createManyAndReturn',
  'update', 'updateMany', 'updateManyAndReturn',
  'delete', 'deleteMany',
  'upsert',
]);

// Returns all DB clients that are connected and available (including full/read-only ones)
function getAllClients(manager) {
  return manager.databases
    .filter(db => db.client && db.isAvailable !== false)
    .map(db => db.client);
}

// Lazily connect a database if not yet connected, then return its client.
// Returns null if connection failed.
async function getOrConnectClient(db, manager) {
  if (db.isAvailable === false) return null;
  if (db.client) return db.client;
  try {
    db.client = manager.createClient(db.url);
    await db.client.$connect();
    db.isAvailable = true;
    return db.client;
  } catch (e) {
    db.isAvailable = false;
    console.warn(`⚠️ [DB] Lazy-connect to DB #${db.index} failed: ${e.message}`);
    return null;
  }
}

// Create a smart model proxy that:
//   - For WRITEs: uses only the active (non-full) DB
//   - For findMany: queries ALL DBs, merges + deduplicates + re-sorts
//   - For findFirst/findUnique: tries active first, then fallback to other DBs
//   - For count: sums across all DBs
//   - For other reads: uses active DB only
function createModelProxy(modelName, manager) {
  return new Proxy({}, {
    get(target, method) {
      if (typeof method !== 'string') return undefined;

      return async (...args) => {
        // ── WRITES: active DB first, fallback to ALL other DBs on P2025 ────
        if (WRITE_METHODS.has(method)) {
          const activeClient = await manager.getActiveClient();
          try {
            return await activeClient[modelName][method](...args);
          } catch (err) {
            // P2025 = "Record to update/delete not found" — record may live in another DB
            if (err.code === 'P2025' && (method === 'update' || method === 'delete' || method === 'upsert')) {
              for (const db of manager.databases) {
                if (db.index === manager.activeIndex) continue;
                const client = await getOrConnectClient(db, manager); // lazy-connect if needed
                if (!client) continue;
                try {
                  return await client[modelName][method](...args);
                } catch (innerErr) {
                  if (innerErr.code === 'P2025') continue; // not in this DB either
                  throw innerErr;
                }
              }
            }
            throw err; // re-throw if no DB had the record or different error
          }
        }

        const allClients = getAllClients(manager);

        // ── count: sum from all DBs ──────────────────────────────────────────
        if (method === 'count') {
          if (allClients.length <= 1) {
            const c = await manager.getActiveClient();
            return c[modelName].count(...args);
          }
          const counts = await Promise.allSettled(
            allClients.map(c => c[modelName].count(...args))
          );
          return counts.reduce((sum, r) => sum + (r.status === 'fulfilled' ? (r.value || 0) : 0), 0);
        }

        // ── aggregate / groupBy: active DB only (too complex to merge) ──────
        if (method === 'aggregate' || method === 'groupBy') {
          const c = await manager.getActiveClient();
          return c[modelName][method](...args);
        }

        // ── findMany: merge from ALL DBs ─────────────────────────────────────
        if (method === 'findMany') {
          if (allClients.length <= 1) {
            const c = await manager.getActiveClient();
            return c[modelName].findMany(...args);
          }

          const opts = args[0] || {};
          const { take, skip, orderBy, ...restOpts } = opts;

          // Query each DB without take/skip so we get everything to merge
          const settled = await Promise.allSettled(
            allClients.map(c => c[modelName].findMany({ ...restOpts, take: undefined, skip: undefined }))
          );

          const seen = new Set();
          const merged = [];
          for (const res of settled) {
            if (res.status !== 'fulfilled') continue;
            for (const item of res.value) {
              const key = item.id || JSON.stringify(item);
              if (!seen.has(key)) {
                seen.add(key);
                merged.push(item);
              }
            }
          }

          // Re-sort by the original orderBy (supports simple single-field orderBy)
          if (orderBy) {
            const ob = Array.isArray(orderBy) ? orderBy[0] : orderBy;
            const [field, dir] = Object.entries(ob)[0];
            const order = (typeof dir === 'string' ? dir : dir?.sort || 'asc').toLowerCase();
            merged.sort((a, b) => {
              const av = a[field], bv = b[field];
              if (av == null && bv == null) return 0;
              if (av == null) return 1;
              if (bv == null) return -1;
              const cmp = av < bv ? -1 : av > bv ? 1 : 0;
              return order === 'desc' ? -cmp : cmp;
            });
          } else if (merged.length > 0 && merged[0]?.createdAt) {
            // Default: newest first
            merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          }

          // Apply skip/take
          const s = skip || 0;
          const sliced = merged.slice(s);
          return take ? sliced.slice(0, take) : sliced;
        }

        // ── findFirst / findUnique: active DB first, fallback to others ──────
        if (method === 'findFirst' || method === 'findFirstOrThrow' ||
            method === 'findUnique' || method === 'findUniqueOrThrow') {
          const activeClient = await manager.getActiveClient();
          try {
            const result = await activeClient[modelName][method](...args);
            if (result !== null && result !== undefined) return result;
          } catch (e) {
            if (method.endsWith('OrThrow')) {
              // Try other DBs before throwing
            } else {
              throw e;
            }
          }

          // Not found in active DB — check ALL other DBs (lazy-connect if needed)
          for (const db of manager.databases) {
            if (db.index === manager.activeIndex) continue;
            const client = await getOrConnectClient(db, manager);
            if (!client) continue;
            try {
              const baseMethod = method.replace('OrThrow', '');
              const result = await client[modelName][baseMethod](...args);
              if (result !== null && result !== undefined) return result;
            } catch (_) {}
          }

          // If OrThrow and still not found, let active client throw the proper error
          if (method.endsWith('OrThrow')) {
            return activeClient[modelName][method](...args);
          }
          return null;
        }

        // ── Default: use active DB ────────────────────────────────────────────
        const c = await manager.getActiveClient();
        const fn = c[modelName][method];
        if (typeof fn === 'function') return fn.call(c[modelName], ...args);
        return fn;
      };
    },
  });
}

// ─── Main Prisma Proxy ────────────────────────────────────────────────────────
const prismaProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === '__dbManager') return dbManager;
    if (prop === '$connect') return () => dbManager.initialize();
    if (prop === '$disconnect') return () => dbManager.disconnectAll();

    // Special Prisma client methods — route to active client
    if (typeof prop === 'string' && prop.startsWith('$')) {
      return async (...args) => {
        const c = await dbManager.getActiveClient();
        const fn = c[prop];
        return typeof fn === 'function' ? fn.call(c, ...args) : fn;
      };
    }

    // Model delegates — return a smart read/write proxy
    if (typeof prop === 'string') {
      return createModelProxy(prop, dbManager);
    }

    return undefined;
  },
});

module.exports = prismaProxy;
