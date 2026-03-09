const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { uploadListingMedia, ALLOWED_VIDEO_TYPES } = require('../utils/upload');
const { uploadImageFile, uploadMultipleImages } = require('../utils/imageUpload');
const { uploadMultipleVideosToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

// ============ PUBLIC ROUTES ============

/**
 * GET /api/cloth-brands
 * Browse all active cloth brands
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const where = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    const brands = await prisma.clothBrand.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, address: true, phone: true, whatsapp: true,
        description: true, image: true, isActive: true,
        _count: { select: { deals: { where: { isActive: true } } } },
      },
    });

    res.json({ brands });
  } catch (error) {
    console.error('Get cloth brands error:', error);
    res.status(500).json({ error: 'Failed to load cloth brands.' });
  }
});

/**
 * GET /api/cloth-brands/deals/all
 * Get all active deals from all brands
 */
router.get('/deals/all', async (req, res) => {
  try {
    const deals = await prisma.brandDeal.findMany({
      where: {
        isActive: true,
        brand: { isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        brand: {
          select: { id: true, name: true, image: true, address: true, phone: true },
        },
      },
    });

    res.json({ deals });
  } catch (error) {
    console.error('Get all brand deals error:', error);
    res.status(500).json({ error: 'Failed to load deals.' });
  }
});

/**
 * GET /api/cloth-brands/owner/profile
 */
router.get('/owner/profile', authenticateBrand, async (req, res) => {
  try {
    const brand = await prisma.clothBrand.findUnique({
      where: { id: req.brandId },
      select: {
        id: true, name: true, address: true, phone: true, whatsapp: true,
        description: true, image: true, email: true,
        deals: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!brand) return res.status(404).json({ error: 'Brand not found.' });
    res.json(brand);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

/**
 * GET /api/cloth-brands/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const brand = await prisma.clothBrand.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, address: true, phone: true, whatsapp: true,
        description: true, image: true,
        deals: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, description: true, price: true,
            originalPrice: true, images: true, videos: true, expiresAt: true, createdAt: true,
          },
        },
      },
    });

    if (!brand) return res.status(404).json({ error: 'Brand not found.' });
    res.json(brand);
  } catch (error) {
    console.error('Get brand error:', error);
    res.status(500).json({ error: 'Failed to load brand.' });
  }
});

// ============ ADMIN: MANAGE BRANDS ============

/**
 * POST /api/cloth-brands/admin/create
 */
router.post('/admin/create', authenticate, adminOnly, uploadListingMedia.single('image'), async (req, res) => {
  try {
    const { name, address, phone, whatsapp, description, email, password } = req.body;

    if (!name || !address || !email || !password) {
      return res.status(400).json({ error: 'Name, address, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await prisma.clothBrand.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A brand with this email already exists.' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadImageFile(req.file);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const brand = await prisma.clothBrand.create({
      data: {
        name,
        address,
        phone: phone || null,
        whatsapp: whatsapp || null,
        description: description || null,
        email,
        password: hashedPassword,
        image: imageUrl,
      },
    });

    res.status(201).json({
      message: 'Brand created! Share login credentials with the owner.',
      brand: { id: brand.id, name: brand.name, email: brand.email },
    });
  } catch (error) {
    console.error('Create brand error:', error);
    res.status(500).json({ error: 'Failed to create brand.' });
  }
});

/**
 * PUT /api/cloth-brands/admin/:id
 */
router.put('/admin/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, address, phone, whatsapp, description, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (address !== undefined) data.address = address;
    if (phone !== undefined) data.phone = phone;
    if (whatsapp !== undefined) data.whatsapp = whatsapp;
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;

    const brand = await prisma.clothBrand.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ message: 'Brand updated.', brand });
  } catch (error) {
    console.error('Update brand error:', error);
    res.status(500).json({ error: 'Failed to update brand.' });
  }
});

/**
 * DELETE /api/cloth-brands/admin/:id
 */
router.delete('/admin/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await prisma.clothBrand.delete({ where: { id: req.params.id } });
    res.json({ message: 'Brand deleted.' });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({ error: 'Failed to delete brand.' });
  }
});

// ============ BRAND OWNER: LOGIN & MANAGE DEALS ============

/**
 * POST /api/cloth-brands/auth/login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const brand = await prisma.clothBrand.findUnique({ where: { email } });
    if (!brand) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    if (!brand.isActive) {
      return res.status(403).json({ error: 'This brand account is deactivated.' });
    }

    const valid = await bcrypt.compare(password, brand.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { brandId: brand.id, type: 'CLOTH_BRAND' },
      process.env.JWT_SECRET,
    );

    res.json({
      token,
      brand: {
        id: brand.id,
        name: brand.name,
        email: brand.email,
        image: brand.image,
      },
    });
  } catch (error) {
    console.error('Brand login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * Middleware: authenticate brand owner via JWT
 */
function authenticateBrand(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.brandId || decoded.type !== 'CLOTH_BRAND') {
      return res.status(401).json({ error: 'Invalid brand token.' });
    }
    req.brandId = decoded.brandId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * POST /api/cloth-brands/owner/deals
 * Brand owner creates a deal with images + optional video (30MB)
 */
router.post('/owner/deals', authenticateBrand, uploadListingMedia.array('media', 6), async (req, res) => {
  try {
    const { title, description, price, originalPrice, expiresAt } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Deal title is required.' });
    }

    let imageUrls = [];
    let videoUrls = [];
    if (req.files && req.files.length > 0) {
      const imageFiles = req.files.filter(f => !ALLOWED_VIDEO_TYPES.includes(f.mimetype));
      const videoFiles = req.files.filter(f => ALLOWED_VIDEO_TYPES.includes(f.mimetype));
      if (imageFiles.length > 0) imageUrls = await uploadMultipleImages(imageFiles);
      if (videoFiles.length > 0) videoUrls = await uploadMultipleVideosToCloudinary(videoFiles, 'shahkot/brands');
    }

    const deal = await prisma.brandDeal.create({
      data: {
        brandId: req.brandId,
        title,
        description: description || null,
        price: price || null,
        originalPrice: originalPrice || null,
        images: imageUrls,
        videos: videoUrls,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json({ message: 'Deal created!', deal });
  } catch (error) {
    console.error('Create brand deal error:', error);
    res.status(500).json({ error: 'Failed to create deal.' });
  }
});

/**
 * PUT /api/cloth-brands/owner/deals/:dealId
 */
router.put('/owner/deals/:dealId', authenticateBrand, async (req, res) => {
  try {
    const deal = await prisma.brandDeal.findUnique({ where: { id: req.params.dealId } });
    if (!deal || deal.brandId !== req.brandId) {
      return res.status(404).json({ error: 'Deal not found.' });
    }

    const { title, description, price, originalPrice, isActive, expiresAt } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (originalPrice !== undefined) data.originalPrice = originalPrice;
    if (isActive !== undefined) data.isActive = isActive;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const updated = await prisma.brandDeal.update({ where: { id: req.params.dealId }, data });
    res.json({ message: 'Deal updated.', deal: updated });
  } catch (error) {
    console.error('Update brand deal error:', error);
    res.status(500).json({ error: 'Failed to update deal.' });
  }
});

/**
 * DELETE /api/cloth-brands/owner/deals/:dealId
 */
router.delete('/owner/deals/:dealId', authenticateBrand, async (req, res) => {
  try {
    const deal = await prisma.brandDeal.findUnique({ where: { id: req.params.dealId } });
    if (!deal || deal.brandId !== req.brandId) {
      return res.status(404).json({ error: 'Deal not found.' });
    }

    await prisma.brandDeal.delete({ where: { id: req.params.dealId } });
    res.json({ message: 'Deal deleted.' });
  } catch (error) {
    console.error('Delete brand deal error:', error);
    res.status(500).json({ error: 'Failed to delete deal.' });
  }
});

module.exports = router;
