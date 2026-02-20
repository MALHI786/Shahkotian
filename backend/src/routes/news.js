const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { upload } = require('../utils/upload');
const { uploadMultipleToCloudinary } = require('../utils/cloudinaryUpload');

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
 * Create news article (REPORTERS or ADMIN)
 */
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let reporterId = null;
    let authorName = 'Admin';

    // Check if reporter token
    if (decoded.reporterId) {
      const reporter = await prisma.newsReporter.findUnique({
        where: { id: decoded.reporterId },
      });
      if (!reporter || !reporter.isActive) {
        return res.status(403).json({ error: 'Reporter account not found or disabled.' });
      }
      reporterId = reporter.id;
      authorName = reporter.name;
    } else if (decoded.id) {
      // Check if admin user
      const adminUser = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!adminUser || adminUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only reporters and admins can post news.' });
      }
      authorName = adminUser.name;
    } else {
      return res.status(403).json({ error: 'Invalid token.' });
    }

    const { title, content, category } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Title, content, and category are required.' });
    }

    // Upload images
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = await uploadMultipleToCloudinary(req.files, 'news');
    }

    const article = await prisma.news.create({
      data: {
        reporterId,
        title,
        content,
        images: imageUrls,
        category,
      },
      include: {
        reporter: { select: { name: true } },
      },
    });

    res.status(201).json({ message: 'News article published!', article: { ...article, authorName } });
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
