const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { geofenceCheck } = require('../middleware/geofence');
const { isWithinShahkot } = require('../utils/geolocation');
const { uploadImageFile } = require('../utils/imageUpload');
const { sendEmail } = require('../utils/email');
const multer = require('multer');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
 * GET /api/auth/test-smtp
 * Debug endpoint — tests if Gmail SMTP is working from this server
 * Remove after confirming email works on Render
 */
router.get('/test-smtp', async (req, res) => {
  const testEmail = req.query.email || process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  const result = await sendEmail(testEmail, '✅ SMTP Test — Apna Shahkot', '<p>SMTP is working!</p>');
  res.json({
    success: result.ok,
    error: result.error || null,
    usedEmail: process.env.EMAIL_USER,
    usedPass: process.env.EMAIL_PASS ? '****' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET',
    message: result.ok ? 'Email sent successfully!' : 'SMTP FAILED — see error above',
  });
});


router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    // Check email not already registered
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered. Please login.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any old OTPs for this email, then create a fresh one
    await prisma.emailOtp.deleteMany({ where: { email } });
    await prisma.emailOtp.create({ data: { email, otp, expiresAt } });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
        <div style="background:#0C8A43;padding:28px;border-radius:10px 10px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">🏘️ APNA SHAHKOT</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;">Email Verification</p>
        </div>
        <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
          <h2 style="color:#1A2E1A;">Your OTP Code</h2>
          <p style="color:#555;line-height:1.6;">Use this one-time password to complete your registration:</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="font-size:42px;font-weight:900;letter-spacing:10px;color:#0C8A43;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <p style="color:#aaa;font-size:11px;margin-top:24px;">If you did not request this, please ignore this email.</p>
        </div>
      </div>`;

    const result = await sendEmail(email, '🔐 Your Apna Shahkot OTP Code', html);
    if (!result.ok) {
      console.error('OTP email failed:', result.error);
      return res.status(500).json({ error: `Failed to send OTP email. (${result.error || 'SMTP error'})` });
    }

    res.json({ message: 'OTP sent to your email. Valid for 10 minutes.' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

/**
 * POST /api/auth/register
 * Register with email + OTP + password (no Firebase required)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, otp, phone, whatsapp, latitude, longitude } = req.body;

    // Validate required fields
    if (!name || !email || !password || !otp) {
      return res.status(400).json({ error: 'Name, email, password, and OTP are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Verify OTP
    const otpRecord = await prisma.emailOtp.findFirst({
      where: { email, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    }
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
    }
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Check email not already registered
    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ error: 'This email is already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mark OTP as used
    await prisma.emailOtp.update({ where: { id: otpRecord.id }, data: { used: true } });

    // Determine role
    const adminEmail = process.env.ADMIN_EMAIL || 'mypcjnaab@gmail.com';
    const adminPhone = process.env.ADMIN_PHONE || '+923425844921';
    const userCount = await prisma.user.count();
    const isAdmin =
      userCount === 0 ||
      email.toLowerCase() === adminEmail.toLowerCase() ||
      (phone && phone === adminPhone);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        whatsapp: whatsapp || phone || null,
        password: hashedPassword,
        firebaseUid: null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
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
      message: 'Registration successful! Welcome to Apna Shahkot.',
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
 * Login with email + password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, latitude, longitude } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email. Please register first.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact admin.' });
    }

    // Auto-promote to admin if email matches admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'mypcjnaab@gmail.com';
    let userRole = user.role;
    if (user.role !== 'ADMIN' && email.toLowerCase() === adminEmail.toLowerCase()) {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      userRole = 'ADMIN';
    }

    // Update location
    if (latitude && longitude) {
      await prisma.user.update({
        where: { id: user.id },
        data: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
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
 * POST /api/auth/forgot-password
 * Send OTP to an existing user's email for password reset
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailOtp.deleteMany({ where: { email } });
    await prisma.emailOtp.create({ data: { email, otp, expiresAt } });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;">
        <div style="background:#0C8A43;padding:28px;border-radius:10px 10px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">🏘️ APNA SHAHKOT</h1>
          <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;">Password Reset</p>
        </div>
        <div style="background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px;">
          <h2 style="color:#1A2E1A;">Reset Your Password</h2>
          <p style="color:#555;line-height:1.6;">Use this OTP to reset your password:</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="font-size:42px;font-weight:900;letter-spacing:10px;color:#0C8A43;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">This code expires in <strong>10 minutes</strong>.</p>
        </div>
      </div>`;

    const result = await sendEmail(email, '🔐 Reset Your Apna Shahkot Password', html);
    if (!result.ok) {
      return res.status(500).json({ error: 'Failed to send OTP email.' });
    }

    res.json({ message: 'OTP sent to your email for password reset.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Verify OTP and set new password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const otpRecord = await prisma.emailOtp.findFirst({
      where: { email, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    }
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Incorrect OTP.' });
    }
    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: (await prisma.user.findFirst({ where: { email } })).id },
      data: { password: hashedPassword },
    });

    await prisma.emailOtp.update({ where: { id: otpRecord.id }, data: { used: true } });

    res.json({ message: 'Password reset successful! You can now login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
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

    const photoUrl = await uploadImageFile(req.file);

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
