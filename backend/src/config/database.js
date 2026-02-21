const { PrismaClient } = require('@prisma/client');

const DB_SIZE_LIMIT_MB = parseInt(process.env.DB_SIZE_LIMIT_MB || '450', 10);
const CHECK_INTERVAL_MS = parseInt(process.env.DB_CHECK_INTERVAL_MS || String(60 * 60 * 1000), 10);

class DatabaseManager {
  constructor() {
    this.databases = [];
    this.activeIndex = parseInt(process.env.ACTIVE_DB_INDEX || '0', 10);
    this.initialized = false;
    this._fallback = null;
    this.checkTimer = null;
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
    this.activeIndex = newIndex;
    process.env.ACTIVE_DB_INDEX = String(newIndex);
    const db = this.databases[newIndex];
    if (!db.client) { db.client = this.createClient(db.url); await db.client.$connect(); }
    return this.getActiveClient();
  }

  async autoSwitch() {
    try {
      const client = await this.getActiveClient();
      const size = await this.checkDatabaseSize(client);
      if (size >= 0) this.databases[this.activeIndex].sizeMB = size;
      if (size >= DB_SIZE_LIMIT_MB) {
        const next = await this.findAvailableDatabase();
        if (next >= 0) await this.switchDatabase(next);
      }
    } catch (e) {
      // ignore
    }
  }

  startSizeMonitor() {
    setTimeout(() => this.autoSwitch(), 5000);
    this.checkTimer = setInterval(() => this.autoSwitch(), CHECK_INTERVAL_MS);
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

const prismaProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === '__dbManager') return dbManager;
    if (prop === '$connect') return () => dbManager.initialize();
    if (prop === '$disconnect') return () => dbManager.disconnectAll();

    // Try active database client first
    const active = dbManager.databases[dbManager.activeIndex];
    if (active && active.client) {
      const val = active.client[prop];
      if (val !== undefined && val !== null) {
        // Prisma model delegates (prisma.user, prisma.post etc.) are objects, not functions.
        // Only bind if it's actually a function, otherwise return as-is.
        return typeof val === 'function' ? val.bind(active.client) : val;
      }
    }

    // Fallback to single-DB client
    if (!dbManager._fallback) {
      dbManager._fallback = new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });
    }
    const fval = dbManager._fallback[prop];
    return typeof fval === 'function' ? fval.bind(dbManager._fallback) : fval;
  }
});

module.exports = prismaProxy;
