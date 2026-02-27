const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { upload } = require('../utils/upload');
const { uploadImageFile } = require('../utils/imageUpload');

const router = express.Router();

// ============ PUBLIC ROUTES ============

/**
 * GET /api/restaurants
 * Browse all active restaurants
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

    const restaurants = await prisma.restaurant.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, address: true, phone: true, whatsapp: true,
        description: true, image: true, isActive: true,
        _count: { select: { deals: { where: { isActive: true } } } },
      },
    });

    res.json({ restaurants });
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({ error: 'Failed to load restaurants.' });
  }
});

/**
 * GET /api/restaurants/:id
 * Get single restaurant with its active deals
 */
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, address: true, phone: true, whatsapp: true,
        description: true, image: true,
        deals: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, description: true, price: true,
            originalPrice: true, image: true, expiresAt: true, createdAt: true,
          },
        },
      },
    });

    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' });
    res.json(restaurant);
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({ error: 'Failed to load restaurant.' });
  }
});

/**
 * GET /api/restaurants/deals/all
 * Get all active deals from all restaurants
 */
router.get('/deals/all', async (req, res) => {
  try {
    const deals = await prisma.deal.findMany({
      where: {
        isActive: true,
        restaurant: { isActive: true },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: {
          select: { id: true, name: true, image: true, address: true, phone: true },
        },
      },
    });

    res.json({ deals });
  } catch (error) {
    console.error('Get all deals error:', error);
    res.status(500).json({ error: 'Failed to load deals.' });
  }
});

// ============ ADMIN: MANAGE RESTAURANTS ============

/**
 * POST /api/restaurants/admin/create
 * Admin creates a restaurant with login credentials
 */
router.post('/admin/create', authenticate, adminOnly, upload.single('image'), async (req, res) => {
  try {
    const { name, address, phone, whatsapp, description, email, password } = req.body;

    if (!name || !address || !email || !password) {
      return res.status(400).json({ error: 'Name, address, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check email uniqueness
    const existing = await prisma.restaurant.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A restaurant with this email already exists.' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadImageFile(req.file);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const restaurant = await prisma.restaurant.create({
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
      message: 'Restaurant created! Share login credentials with the owner.',
      restaurant: { id: restaurant.id, name: restaurant.name, email: restaurant.email },
    });
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({ error: 'Failed to create restaurant.' });
  }
});

/**
 * PUT /api/restaurants/admin/:id
 * Admin updates a restaurant
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

    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ message: 'Restaurant updated.', restaurant });
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({ error: 'Failed to update restaurant.' });
  }
});

/**
 * DELETE /api/restaurants/admin/:id
 * Admin deletes a restaurant
 */
router.delete('/admin/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await prisma.restaurant.delete({ where: { id: req.params.id } });
    res.json({ message: 'Restaurant deleted.' });
  } catch (error) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({ error: 'Failed to delete restaurant.' });
  }
});

// ============ RESTAURANT OWNER: LOGIN & MANAGE DEALS ============

/**
 * POST /api/restaurants/auth/login
 * Restaurant owner login (separate from user login)
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { email } });
    if (!restaurant) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    if (!restaurant.isActive) {
      return res.status(403).json({ error: 'This restaurant account is deactivated.' });
    }

    const valid = await bcrypt.compare(password, restaurant.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Generate a token with restaurantId claim
    const token = jwt.sign(
      { restaurantId: restaurant.id, type: 'RESTAURANT' },
      process.env.JWT_SECRET,
    );

    res.json({
      token,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        email: restaurant.email,
        image: restaurant.image,
      },
    });
  } catch (error) {
    console.error('Restaurant login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * Middleware: authenticate restaurant owner via JWT
 */
function authenticateRestaurant(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.restaurantId || decoded.type !== 'RESTAURANT') {
      return res.status(401).json({ error: 'Invalid restaurant token.' });
    }
    req.restaurantId = decoded.restaurantId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * GET /api/restaurants/owner/profile
 * Get restaurant owner's own restaurant
 */
router.get('/owner/profile', authenticateRestaurant, async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.restaurantId },
      select: {
        id: true, name: true, address: true, phone: true, whatsapp: true,
        description: true, image: true, email: true,
        deals: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' });
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

/**
 * POST /api/restaurants/owner/deals
 * Restaurant owner creates a deal
 */
router.post('/owner/deals', authenticateRestaurant, upload.single('image'), async (req, res) => {
  try {
    const { title, description, price, originalPrice, expiresAt } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Deal title is required.' });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadImageFile(req.file);
    }

    const deal = await prisma.deal.create({
      data: {
        restaurantId: req.restaurantId,
        title,
        description: description || null,
        price: price || null,
        originalPrice: originalPrice || null,
        image: imageUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json({ message: 'Deal created!', deal });
  } catch (error) {
    console.error('Create deal error:', error);
    res.status(500).json({ error: 'Failed to create deal.' });
  }
});

/**
 * PUT /api/restaurants/owner/deals/:dealId
 * Restaurant owner updates a deal
 */
router.put('/owner/deals/:dealId', authenticateRestaurant, async (req, res) => {
  try {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
    if (!deal || deal.restaurantId !== req.restaurantId) {
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

    const updated = await prisma.deal.update({ where: { id: req.params.dealId }, data });
    res.json({ message: 'Deal updated.', deal: updated });
  } catch (error) {
    console.error('Update deal error:', error);
    res.status(500).json({ error: 'Failed to update deal.' });
  }
});

/**
 * DELETE /api/restaurants/owner/deals/:dealId
 * Restaurant owner deletes a deal
 */
router.delete('/owner/deals/:dealId', authenticateRestaurant, async (req, res) => {
  try {
    const deal = await prisma.deal.findUnique({ where: { id: req.params.dealId } });
    if (!deal || deal.restaurantId !== req.restaurantId) {
      return res.status(404).json({ error: 'Deal not found.' });
    }

    await prisma.deal.delete({ where: { id: req.params.dealId } });
    res.json({ message: 'Deal deleted.' });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ error: 'Failed to delete deal.' });
  }
});

module.exports = router;
