const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { geofenceCheck } = require('../middleware/geofence');
const { isWithinShahkot } = require('../utils/geolocation');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');
const multer = require('multer');

const storage = multer.memoryStorage();
const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only images allowed'), false);
  },
}).single('photo');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user (after Firebase phone verification)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, whatsapp, firebaseUid, latitude, longitude } = req.body;

    // Validate required fields
    if (!name || !phone || !firebaseUid) {
      return res.status(400).json({ error: 'Name, phone, and Firebase UID are required.' });
    }

    // Geofence disabled - allow registration from anywhere
    // Store location if provided, but don't block
    const userLat = latitude ? parseFloat(latitude) : null;
    const userLng = longitude ? parseFloat(longitude) : null;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          { firebaseUid },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'User with this phone number already exists.' });
    }

    // Determine role (first user or predefined admin phone/email becomes admin)
    const userCount = await prisma.user.count();
    const adminPhone = process.env.ADMIN_PHONE || '+923425844921';
    const adminEmail = process.env.ADMIN_EMAIL || 'mypcjnaab@gmail.com';
    const isAdmin = userCount === 0 || phone === adminPhone || (email && email.toLowerCase() === adminEmail.toLowerCase());

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        whatsapp: whatsapp || phone,
        firebaseUid,
        latitude: userLat,
        longitude: userLng,
        role: isAdmin ? 'ADMIN' : 'USER',
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    res.status(201).json({
      message: 'Registration successful! Welcome to Shahkot App.',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        whatsapp: user.whatsapp,
        role: user.role,
        photoUrl: user.photoUrl,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Login with Firebase UID (after phone verification)
 */
router.post('/login', async (req, res) => {
  try {
    const { firebaseUid, latitude, longitude } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ error: 'Firebase UID is required.' });
    }

    // Geofence disabled - location check removed

    const user = await prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact admin.' });
    }

    // Auto-promote to admin if phone/email matches admin credentials
    const adminPhone = process.env.ADMIN_PHONE || '+923425844921';
    const adminEmail = process.env.ADMIN_EMAIL || 'mypcjnaab@gmail.com';
    let userRole = user.role;
    
    if (user.role !== 'ADMIN' && (user.phone === adminPhone || (user.email && user.email.toLowerCase() === adminEmail.toLowerCase()))) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      userRole = 'ADMIN';
    }

    // Update location
    if (latitude && longitude) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        whatsapp: user.whatsapp,
        role: userRole,
        photoUrl: user.photoUrl,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        whatsapp: true,
        photoUrl: true,
        role: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            listings: true,
          },
        },
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, email, whatsapp, photoUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(whatsapp && { whatsapp }),
        ...(photoUrl && { photoUrl }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        whatsapp: true,
        photoUrl: true,
        role: true,
      },
    });

    res.json({ message: 'Profile updated.', user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/**
 * POST /api/auth/check-location
 * Check if a location is within Shahkot geofence
 */
router.post('/check-location', (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude are required.' });
  }

  const result = isWithinShahkot(parseFloat(latitude), parseFloat(longitude));

  res.json({
    allowed: result.isWithin,
    distance: result.distance,
    maxRadius: result.maxRadius,
    message: result.isWithin
      ? 'You are within Shahkot area. Welcome!'
      : `You are ${result.distance}KM away from Shahkot. Only residents within ${result.maxRadius}KM can use this app.`,
  });
});

/**
 * POST /api/auth/profile/photo
 * Upload profile photo
 */
router.post('/profile/photo', authenticate, uploadPhoto, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded.' });
    }

    const photoUrl = await uploadToCloudinary(req.file.buffer, 'profiles');

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        whatsapp: true,
        photoUrl: true,
        role: true,
      },
    });

    res.json({ message: 'Profile photo updated!', user });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo.' });
  }
});

module.exports = router;
