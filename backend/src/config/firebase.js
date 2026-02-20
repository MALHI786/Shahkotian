const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  console.warn('FIREBASE_SERVICE_ACCOUNT_PATH is not set. Firebase Admin will not be initialized.');
  module.exports = null;
  return;
}

let serviceAccount;
try {
  // Resolve absolute path
  const resolved = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(process.cwd(), serviceAccountPath);
  serviceAccount = require(resolved);
} catch (err) {
  console.error('Failed to load Firebase service account JSON:', err.message);
  module.exports = null;
  return;
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized');
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err.message);
}

module.exports = admin;
