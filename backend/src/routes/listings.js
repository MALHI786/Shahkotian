const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../utils/upload');
const { uploadMultipleToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

/**
 * GET /api/listings
 * Get all listings with filters and pagination
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { category, search, minPrice, maxPrice, sortBy } = req.query;

    const where = { isSold: false };

    if (category) where.category = category;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'price_low') orderBy = { price: 'asc' };
    if (sortBy === 'price_high') orderBy = { price: 'desc' };

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          user: {
            select: { id: true, name: true, photoUrl: true },
          },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    res.json({
      listings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Listings error:', error);
    res.status(500).json({ error: 'Failed to load listings.' });
  }
});

/**
 * GET /api/listings/:id
 * Get single listing details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true, whatsapp: true },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    res.json({ listing });
  } catch (error) {
    console.error('Listing detail error:', error);
    res.status(500).json({ error: 'Failed to load listing.' });
  }
});

/**
 * POST /api/listings
 * Create a new listing (images only, NO videos)
 */
router.post('/', authenticate, upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, price, category, whatsapp } = req.body;

    // Validate required fields
    if (!title || !description || !price || !category || !whatsapp) {
      return res.status(400).json({
        error: 'Title, description, price, category, and WhatsApp number are required.',
      });
    }

    // Upload images
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = await uploadMultipleToCloudinary(req.files, 'listings');
    }

    const listing = await prisma.listing.create({
      data: {
        userId: req.user.id,
        title,
        description,
        price: parseFloat(price),
        category,
        images: imageUrls,
        whatsapp,
      },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true },
        },
      },
    });

    res.status(201).json({ message: 'Listing created!', listing });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing.' });
  }
});

/**
 * PUT /api/listings/:id
 * Update own listing
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (listing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only edit your own listings.' });
    }

    const { title, description, price, category, whatsapp, isSold } = req.body;

    const updated = await prisma.listing.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(price && { price: parseFloat(price) }),
        ...(category && { category }),
        ...(whatsapp && { whatsapp }),
        ...(isSold !== undefined && { isSold }),
      },
    });

    res.json({ message: 'Listing updated.', listing: updated });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: 'Failed to update listing.' });
  }
});

/**
 * DELETE /api/listings/:id
 * Delete own listing
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });
    if (listing.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only delete your own listings.' });
    }

    await prisma.listing.delete({ where: { id: req.params.id } });
    res.json({ message: 'Listing deleted.' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

/**
 * GET /api/listings/my/all
 * Get current user's listings
 */
router.get('/my/all', authenticate, async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ listings });
  } catch (error) {
    console.error('My listings error:', error);
    res.status(500).json({ error: 'Failed to load your listings.' });
  }
});

module.exports = router;
