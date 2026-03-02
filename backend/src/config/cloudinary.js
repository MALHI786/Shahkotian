// Multi-account Cloudinary manager with auto-rotation + manual switch
// Rotates to the next account when monthly credits reach CLOUDINARY_CREDITS_LIMIT (free = 25/month, rotate at 20)

const { v2: cloudinary } = require('cloudinary');

const CLOUDINARY_CREDITS_LIMIT = parseFloat(process.env.CLOUDINARY_CREDITS_LIMIT || '20');
const CHECK_INTERVAL_MS = parseInt(process.env.CLOUDINARY_CHECK_INTERVAL_MS || String(2 * 60 * 60 * 1000), 10);
const WARNING_THRESHOLD = 0.80; // warn at 80% of credits limit

class CloudinaryManager {
  constructor() {
    this.accounts = [];
    this.activeIndex = parseInt(process.env.ACTIVE_CLOUDINARY_INDEX || '0', 10);
    this.initialized = false;
    this.checkTimer = null;
    this._switching = false;
  }

  parseAccounts() {
    // Try multi-account env var first
    // Format: "cloud_name|api_key|api_secret,cloud_name2|api_key2|api_secret2,..."
    if (process.env.CLOUDINARY_ACCOUNTS) {
      const parsed = process.env.CLOUDINARY_ACCOUNTS.split(',').map((acc, i) => {
        const parts = acc.trim().split('|');
        if (parts.length < 3 || parts[0].startsWith('CLOUD')) return null; // skip placeholders
        return { index: i, cloud_name: parts[0], api_key: parts[1], api_secret: parts.slice(2).join('|'), usageGB: 0, isAvailable: true };
      }).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
    // Fallback to single legacy env vars
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      return [{ index: 0, cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, usageGB: 0, isAvailable: true }];
    }
    return [];
  }

  applyActiveConfig() {
    const acc = this.accounts[this.activeIndex];
    if (!acc) return;
    cloudinary.config({ cloud_name: acc.cloud_name, api_key: acc.api_key, api_secret: acc.api_secret });
  }

  // Fetch monthly credits usage from Cloudinary API
  async checkCredits(account) {
    try {
      const auth = Buffer.from(`${account.api_key}:${account.api_secret}`).toString('base64');
      const res = await fetch(`https://api.cloudinary.com/v1_1/${account.cloud_name}/usage`, {
        headers: { 'Authorization': `Basic ${auth}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // credits.usage is the monthly credits consumed
      const credits = parseFloat((data.credits?.usage ?? data.storage?.usage / (1024 ** 3) ?? 0).toFixed(3));
      const limit = data.credits?.limit ?? 25;
      return { credits, limit };
    } catch (err) {
      console.warn(`⚠️ [CLOUDINARY] Usage check failed for ${account.cloud_name}: ${err.message}`);
      return { credits: -1, limit: 25 };
    }
  }

  // Manually switch to a specific account index (called from admin dashboard)
  async manualSwitch(index) {
    if (index < 0 || index >= this.accounts.length) throw new Error(`Invalid Cloudinary index: ${index}`);
    const oldIndex = this.activeIndex;
    this.activeIndex = index;
    process.env.ACTIVE_CLOUDINARY_INDEX = String(index);
    this.applyActiveConfig();
    const acc = this.accounts[index];
    console.log(`🔀 [CLOUDINARY] Manual switch #${oldIndex} → #${index} (${acc.cloud_name})`);
    return acc;
  }

  async findAndSwitch() {
    for (let i = 0; i < this.accounts.length; i++) {
      if (i === this.activeIndex) continue;
      const acc = this.accounts[i];
      if (!acc.isAvailable) continue;
      const { credits } = await this.checkCredits(acc);
      if (credits < 0) { acc.isAvailable = false; continue; }
      acc.credits = credits;
      if (credits < CLOUDINARY_CREDITS_LIMIT) {
        const oldIndex = this.activeIndex;
        this.activeIndex = i;
        process.env.ACTIVE_CLOUDINARY_INDEX = String(i);
        this.applyActiveConfig();
        console.log(`🔄 [CLOUDINARY] Auto-switched #${oldIndex} → #${i} (${acc.cloud_name}, ${credits} credits used)`);
        return;
      }
    }
    console.error(`❌ [CLOUDINARY] All ${this.accounts.length} accounts are at/above ${CLOUDINARY_CREDITS_LIMIT} credits!`);
  }

  async autoSwitch() {
    if (this._switching) return;
    this._switching = true;
    try {
      const active = this.accounts[this.activeIndex];
      if (!active) return;
      const { credits, limit } = await this.checkCredits(active);
      if (credits < 0) return;
      active.credits = credits;
      active.creditsLimit = limit;

      const warningAt = CLOUDINARY_CREDITS_LIMIT * WARNING_THRESHOLD;
      if (credits >= warningAt && credits < CLOUDINARY_CREDITS_LIMIT) {
        console.warn(`⚠️ [CLOUDINARY] Account #${this.activeIndex} (${active.cloud_name}) at ${credits}/${limit} credits (${Math.round(credits / limit * 100)}%)`);
      }
      if (credits >= CLOUDINARY_CREDITS_LIMIT) {
        console.log(`🚨 [CLOUDINARY] Account #${this.activeIndex} (${active.cloud_name}) hit ${credits} credits. Rotating...`);
        await this.findAndSwitch();
      }
    } catch (e) {
      console.error('❌ [CLOUDINARY] autoSwitch error:', e.message);
    } finally {
      this._switching = false;
    }
  }

  startUsageMonitor() {
    // First check 20s after startup
    setTimeout(() => this.autoSwitch().catch(console.error), 20000);
    // Then check every CHECK_INTERVAL_MS (default: 2 hours)
    this.checkTimer = setInterval(() => this.autoSwitch().catch(console.error), CHECK_INTERVAL_MS);
    console.log(`⏱️ [CLOUDINARY] Monitor started — checking every ${Math.round(CHECK_INTERVAL_MS / 3600000)}h, rotate at: ${CLOUDINARY_CREDITS_LIMIT} credits`);
  }

  initialize() {
    if (this.initialized) return;
    this.accounts = this.parseAccounts();
    if (this.accounts.length === 0) {
      console.warn('⚠️ [CLOUDINARY] No accounts configured!');
      return;
    }
    // Clamp activeIndex to valid range
    if (this.activeIndex >= this.accounts.length) this.activeIndex = 0;
    this.applyActiveConfig();
    this.startUsageMonitor();
    this.initialized = true;
    console.log(`☁️ [CLOUDINARY] Ready — ${this.accounts.length} account(s), active: #${this.activeIndex} (${this.accounts[this.activeIndex]?.cloud_name}), rotate at: ${CLOUDINARY_CREDITS_LIMIT} credits`);
  }

  async getAllStatus() {
    const results = [];
    for (const acc of this.accounts) {
      let credits = acc.credits ?? 0;
      let creditsLimit = acc.creditsLimit ?? 25;
      if (acc.index === this.activeIndex) {
        const fresh = await this.checkCredits(acc).catch(() => ({ credits: acc.credits ?? 0, limit: 25 }));
        if (fresh.credits >= 0) { credits = fresh.credits; creditsLimit = fresh.limit; acc.credits = credits; acc.creditsLimit = creditsLimit; }
      }
      results.push({
        index: acc.index,
        cloud_name: acc.cloud_name,
        credits,
        creditsLimit,
        rotateAt: CLOUDINARY_CREDITS_LIMIT,
        isActive: acc.index === this.activeIndex,
        isAvailable: acc.isAvailable,
        percentUsed: parseFloat((credits / creditsLimit * 100).toFixed(1)),
      });
    }
    return results;
  }
}

const cloudinaryManager = new CloudinaryManager();
cloudinaryManager.initialize();

// Export the cloudinary v2 instance (always uses the active account config)
module.exports = cloudinary;
// Also expose manager for admin dashboard status checks
module.exports.manager = cloudinaryManager;

