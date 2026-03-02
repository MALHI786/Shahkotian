const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;

// Option 1: JSON content stored directly in env var (for cloud hosts like DigitalOcean
// where you can't upload files). Set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON string.
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var:', err.message);
  }
}

// Option 2: Path to a JSON file (for local dev)
if (!serviceAccount) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    try {
      const resolved = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.join(process.cwd(), serviceAccountPath);
      serviceAccount = require(resolved);
    } catch (err) {
      console.warn('Failed to load Firebase service account JSON file (push notifications disabled):', err.message);
    }
  }
}

if (!serviceAccount) {
  console.warn('⚠️ Firebase Admin not initialized. Push notifications will be disabled.');
  console.warn('   To enable: set FIREBASE_SERVICE_ACCOUNT_JSON env var on DigitalOcean.');
  module.exports = null;
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized');
    module.exports = admin;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err.message);
    module.exports = null;
  }
}
