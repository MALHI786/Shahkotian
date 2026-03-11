/**
 * push-schema-all-dbs.js
 * Runs `prisma db push --skip-generate --accept-data-loss` against every DB
 * listed in DATABASE_URLS so all databases share the same schema.
 *
 * Usage:  node scripts/push-schema-all-dbs.js
 */

require('dotenv').config();
const { execSync } = require('child_process');

const raw = process.env.DATABASE_URLS || process.env.DATABASE_URL || '';
const urls = raw.split(',').map(u => u.trim()).filter(Boolean);

if (urls.length === 0) {
  console.error('❌  No DATABASE_URLS found in .env');
  process.exit(1);
}

console.log(`\n🚀  Pushing schema to ${urls.length} database(s)...\n`);

let passed = 0;
let failed = 0;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  const label = `DB#${i}`;
  process.stdout.write(`  [${label}] pushing... `);
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',   // suppress prisma's own output; we print our own
      cwd: process.cwd(),
    });
    console.log('✅  OK');
    passed++;
  } catch (err) {
    console.log('❌  FAILED');
    const msg = (err.stderr || err.stdout || err.message || '').toString().trim();
    // Print only last 10 lines so it stays readable
    const lines = msg.split('\n').slice(-10).join('\n');
    console.error(`        ${lines}\n`);
    failed++;
  }
}

console.log(`\n📊  Done: ${passed} succeeded, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
