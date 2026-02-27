# Code Citations

## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```


## License: unknown
https://github.com/ubeydullah26/node-driver-report/blob/f41eb648f16dd046be4bb151d5bcf51c40a0fd51/src/app.js

```
Looking at your project structure, I need to update the actual existing files. Let me update them properly.

## Files to Update

### 1. Backend - Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\upload.js
const multer = require('multer');
const path = require('path');

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/avi', 'video/mkv', 'video/mov',
  'video/wmv', 'video/webm', 'video/3gpp', 'video/quicktime',
];

const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return cb(null, true);
  return cb(new Error('Only image files are allowed.'), false);
};

const mediaFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) || ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.avi', '.mkv', '.mov', '.webm', '.3gp'].includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image and video files are allowed.'), false);
};

const storage = multer.memoryStorage();

// Image-only upload (listings, CNIC, etc.) - 5MB max
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// Media upload for posts - supports videos up to 3 minutes (100MB)
const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 8,
    fieldSize: 100 * 1024 * 1024,
  },
});

const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single('image');

const uploadRishta = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
  { name: 'photos', maxCount: 3 },
]);

module.exports = {
  upload, uploadMedia, uploadSingle, uploadRishta,
  ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES,
};
````

### 2. Backend - Cloudinary Upload Utils

````js
// filepath: e:\Shahkot\backend\src\utils\cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary (supports up to 3-minute videos / 100MB)
 * Uses chunked upload for files > 20MB
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const sizeInMB = buffer.length / (1024 * 1024);
    console.log(`📹 Uploading video: ${sizeInMB.toFixed(2)}MB`);

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [{
          quality: 'auto:good',
          format: 'mp4',
          video_codec: 'h264',
          audio_codec: 'aac',
        }],
        eager_async: true,
        ...(sizeInMB > 20 && { chunk_size: 6 * 1024 * 1024 }),
      },
      (error, result) => {
        if (error) {
          console.error('Video upload error:', error);
          reject(new Error(`Video upload failed: ${error.message}`));
        } else {
          console.log(`✅ Video uploaded: ${result.secure_url}`);
          const videoUrl = result.eager?.[0]?.secure_url || result.secure_url;
          resolve(videoUrl);
        }
      }
    );

    // Write in chunks for large videos
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    const writeNextChunk = () => {
      const end = Math.min(offset + chunkSize, buffer.length);
      uploadStream.write(buffer.slice(offset, end));
      offset = end;
      if (offset < buffer.length) setImmediate(writeNextChunk);
      else uploadStream.end();
    };
    writeNextChunk();
  });
}

/**
 * Upload multiple images
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => uploadToCloudinary(file.buffer, folder)));
}

/**
 * Upload multiple videos sequentially to prevent memory issues
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file.buffer, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload failed:', error.message);
    }
  }
  return urls;
}

/**
 * Upload audio to Cloudinary (for voice messages)
 */
async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahkot-app/chat-audio', resource_type: 'video', format: 'm4a' },
      (error, result) => {
        if (error) reject(new Error(`Audio upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Delete from Cloudinary by URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    const parts = imageUrl.split('/');
    const idx = parts.indexOf('shahkot-app');
    if (idx === -1) return;
    const publicId = parts.slice(idx).join('/').replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

module.exports = {
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  uploadVideoToCloudinary,
  uploadMultipleVideosToCloudinary,
  uploadAudioToCloudinary,
  deleteFromCloudinary,
};
````

### 3. Backend - Server with Increased Timeout

````js
// filepath: e:\Shahkot\backend\src\server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ MIDDLEWARE ============
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const
```

