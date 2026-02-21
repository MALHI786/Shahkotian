const cloudinary = require('../config/cloudinary');

async function uploadToCloudinary(file, folder = 'shahkot') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

async function uploadMultipleToCloudinary(files, folder = 'shahkot') {
  const urls = [];
  for (const file of files) {
    const url = await uploadToCloudinary(file, folder);
    urls.push(url);
  }
  return urls;
}

async function uploadVideoToCloudinary(file, folder = 'shahkot/videos') {
  return new Promise((resolve, reject) => {
    const fileSizeMB = file.buffer.length / (1024 * 1024);
    // chunked upload for large files
    if (fileSizeMB > 20) {
      const uploadOptions = {
        folder,
        resource_type: 'video',
        chunk_size: 6 * 1024 * 1024,
        timeout: 300000,
        eager: [{ width: 720, height: 1280, crop: 'limit', quality: 'auto:low', format: 'mp4' }],
        eager_async: true,
      };

      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      });

      const CHUNK_SIZE = 6 * 1024 * 1024;
      let offset = 0;
      const writeChunk = () => {
        while (offset < file.buffer.length) {
          const chunk = file.buffer.slice(offset, offset + CHUNK_SIZE);
          const canContinue = stream.write(chunk);
          offset += chunk.length;
          if (!canContinue) { stream.once('drain', writeChunk); return; }
        }
        stream.end();
      };
      writeChunk();
    } else {
      const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'video', timeout: 120000, transformation: [{ quality: 'auto:low', fetch_format: 'mp4' }] }, (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      });
      stream.end(file.buffer);
    }
  });
}

async function uploadMultipleVideosToCloudinary(files, folder = 'shahkot/videos') {
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadVideoToCloudinary(file, folder);
      urls.push(url);
    } catch (error) {
      console.error('Video upload skipped:', error.message);
    }
  }
  return urls;
}

async function deleteFromCloudinary(imageUrl) {
  try {
    if (!imageUrl || !imageUrl.includes('cloudinary')) return;
    const parts = imageUrl.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return;
    const startIdx = parts[uploadIndex + 1].startsWith('v') ? uploadIndex + 2 : uploadIndex + 1;
    const publicId = parts.slice(startIdx).join('/').replace(/\.[^/.]+$/, '');
    const isVideo = imageUrl.includes('/video/') || ['.mp4', '.avi', '.mov', '.webm'].some(ext => imageUrl.endsWith(ext));
    await cloudinary.uploader.destroy(publicId, { resource_type: isVideo ? 'video' : 'image' });
  } catch (error) {
    console.error('Cloudinary delete error:', error.message);
  }
}

async function uploadAudioToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'shahkot/audio', resource_type: 'video', timeout: 60000 }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

module.exports = { uploadToCloudinary, uploadMultipleToCloudinary, uploadVideoToCloudinary, uploadMultipleVideosToCloudinary, uploadAudioToCloudinary, deleteFromCloudinary };
