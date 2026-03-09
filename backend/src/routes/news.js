const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { uploadListingMedia, ALLOWED_VIDEO_TYPES } = require('../utils/upload');
const { uploadMultipleImages } = require('../utils/imageUpload');
const { uploadMultipleVideosToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

/**
 * POST /api/news/reporter/login
 * Login for news reporters (using admin-provided credentials)
 */
router.post('/reporter/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const reporter = await prisma.newsReporter.findUnique({
      where: { email },
    });

    if (!reporter || !reporter.isActive) {
      return res.status(401).json({ error: 'Invalid credentials or account disabled.' });
    }

    const isValidPassword = await bcrypt.compare(password, reporter.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Generate reporter token
    const token = jwt.sign(
      { reporterId: reporter.id, role: 'NEWS_REPORTER' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Reporter login successful!',
      token,
      reporter: {
        id: reporter.id,
        name: reporter.name,
        email: reporter.email,
      },
    });
  } catch (error) {
    console.error('Reporter login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * GET /api/news
 * Get all news articles (public for authenticated users)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, page = 1 } = req.query;
    const limit = 20;

    const where = category ? { category } : {};

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip: (parseInt(page) - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: { name: true },
          },
          user: {
            select: { name: true, photoUrl: true },
          },
        },
      }),
      prisma.news.count({ where }),
    ]);

    res.json({
      news,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('News error:', error);
    res.status(500).json({ error: 'Failed to load news.' });
  }
});

/**
 * GET /api/news/categories
 * Get available news categories
 */
router.get('/categories', authenticate, (req, res) => {
  const categories = [
    { key: 'LOCAL', label: 'Local News' },
    { key: 'SPORTS', label: 'Sports' },
    { key: 'EDUCATION', label: 'Education' },
    { key: 'POLITICS', label: 'Politics' },
    { key: 'BUSINESS', label: 'Business' },
    { key: 'HEALTH', label: 'Health' },
    { key: 'ENTERTAINMENT', label: 'Entertainment' },
    { key: 'OTHER', label: 'Other' },
  ];
  res.json({ categories });
});

/**
 * GET /api/news/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const article = await prisma.news.findUnique({
      where: { id: req.params.id },
      include: {
        reporter: {
          select: { name: true },
        },
        user: {
          select: { name: true, photoUrl: true },
        },
      },
    });

    if (!article) return res.status(404).json({ error: 'News not found.' });
    res.json({ article });
  } catch (error) {
    console.error('News detail error:', error);
    res.status(500).json({ error: 'Failed to load news.' });
  }
});

/**
 * POST /api/news
 * Create news article (ALL AUTHENTICATED USERS)
 */
router.post('/', authenticate, uploadListingMedia.array('media', 6), async (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Title, content, and category are required.' });
    }

    // Separate image files from video files
    let imageUrls = [];
    let videoUrls = [];
    if (req.files && req.files.length > 0) {
      const imageFiles = req.files.filter(f => !ALLOWED_VIDEO_TYPES.includes(f.mimetype));
      const videoFiles = req.files.filter(f => ALLOWED_VIDEO_TYPES.includes(f.mimetype));
      if (imageFiles.length > 0) imageUrls = await uploadMultipleImages(imageFiles);
      if (videoFiles.length > 0) videoUrls = await uploadMultipleVideosToCloudinary(videoFiles, 'shahkot/news');
    }

    // Create news article linked to authenticated user
    const article = await prisma.news.create({
      data: {
        userId: req.user.id,  // Link to authenticated user
        title,
        content,
        images: imageUrls,
        videos: videoUrls,
        category,
      },
      include: {
        user: { select: { name: true, photoUrl: true } },
      },
    });

    res.status(201).json({ 
      message: 'News article published!', 
      article: { 
        ...article, 
        authorName: req.user.name 
      } 
    });
  } catch (error) {
    console.error('Create news error:', error);
    res.status(500).json({ error: 'Failed to publish news.' });
  }
});

/**
 * DELETE /api/news/:id (ADMIN ONLY)
 */
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ message: 'News article deleted.' });
  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({ error: 'Failed to delete news.' });
  }
});

module.exports = router;
