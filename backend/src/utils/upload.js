const multer = require('multer');
const path = require('path');

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/avi', 'video/x-matroska', 'video/quicktime', 'video/webm', 'video/3gpp'];

// Image-only filter
const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

// Image + Video filter (for posts)
const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'];
  if (allowedExts.includes(ext)) return cb(null, true);
  return cb(new Error('Only image and video files are allowed.'), false);
};

// Memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

// Image-only upload (for listings, CNIC, etc.)
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload (images + videos for posts)
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE_MB || '100', 10) * 1024 * 1024;
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 8 },
});

// Single image upload (for tournaments, profile photo, etc.)
const uploadSingle = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('image');

// Upload for CNIC (front and back)
const uploadCNIC = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024, files: 2 } }).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
]);

// Upload for Rishta apply (CNIC front + back + optional personal photos)
const uploadRishta = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024, files: 5 } }).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = { upload, uploadMedia, uploadSingle, uploadCNIC, uploadRishta, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES };
