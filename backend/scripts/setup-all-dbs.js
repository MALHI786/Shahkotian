/**
 * Setup All Databases
 * 
 * This script pushes the Prisma schema to ALL databases in DATABASE_URLS.
 * Run once after adding new databases so they all have the correct tables.
 * 
 * Usage: node scripts/setup-all-dbs.js
 */

require('dotenv').config();
const { execSync } = require('child_process');

const urls = (process.env.DATABASE_URLS || process.env.DATABASE_URL || '')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);

if (urls.length === 0) {
  console.error('No database URLs found in .env');
  process.exit(1);
}

console.log(`Found ${urls.length} database(s). Pushing schema to each...\n`);

let success = 0;
let failed = 0;

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  // Show a safe version of the URL (hide password)
  const safeUrl = url.replace(/:([^@]+)@/, ':****@');
  console.log(`[${i + 1}/${urls.length}] Pushing to: ${safeUrl}`);

  try {
    execSync('npx prisma db push --skip-generate', {
      cwd: require('path').join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
      timeout: 60000,
    });
    console.log(`  ✓ Database ${i + 1} — schema pushed successfully\n`);
    success++;
  } catch (err) {
    console.error(`  ✗ Database ${i + 1} — FAILED: ${err.message}\n`);
    failed++;
  }
}

console.log(`\nDone! ${success} succeeded, ${failed} failed out of ${urls.length} databases.`);
if (failed > 0) process.exit(1);
