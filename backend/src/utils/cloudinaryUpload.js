const cloudinary = require('../config/cloudinary');

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - Image buffer from multer
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string>} Image URL
 */
async function uploadToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'image', // Only images, never videos
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' },
          { width: 1200, crop: 'limit' }, // Max width 1200px
        ],
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload video buffer to Cloudinary
 * @param {Buffer} buffer - Video buffer from multer
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string>} Video URL
 */
async function uploadVideoToCloudinary(buffer, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `shahkot-app/${folder}`,
        resource_type: 'video',
        eager: [
          { quality: 'auto', format: 'mp4' },
        ],
        eager_async: true,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary video upload failed: ${error.message}`));
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload multiple images to Cloudinary
 * @param {Array} files - Array of multer file objects
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string[]>} Array of image URLs
 */
async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  
  const uploadPromises = files.map(file => uploadToCloudinary(file.buffer, folder));
  return Promise.all(uploadPromises);
}

/**
 * Upload multiple videos to Cloudinary
 * @param {Array} files - Array of multer file objects
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise<string[]>} Array of video URLs
 */
async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot') {
  if (!files || files.length === 0) return [];
  
  const uploadPromises = files.map(file => uploadVideoToCloudinary(file.buffer, folder));
  return Promise.all(uploadPromises);
}

/**
 * Delete image from Cloudinary by URL
 * @param {string} imageUrl - The Cloudinary image URL
 */
async function deleteFromCloudinary(imageUrl) {
  try {
    // Extract public_id from URL
    const parts = imageUrl.split('/');
    const folderAndFile = parts.slice(parts.indexOf('shahkot-app')).join('/');
    const publicId = folderAndFile.replace(/\.[^/.]+$/, '');
    
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
  deleteFromCloudinary,
};
