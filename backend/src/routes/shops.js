const express = require('express');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/shops
 * Search shops by product name or browse all
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, category } = req.query;

    let where = {};

    // Search by what user wants to buy
    if (search) {
      where = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { categories: { has: search.toLowerCase() } },
        ],
      };
    }

    const shops = await prisma.shop.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({
      shops,
      searchTerm: search || null,
      message: shops.length > 0
        ? `Found ${shops.length} shop(s) for "${search || 'all'}"`
        : `No shops found for "${search}". Try different keywords.`,
    });
  } catch (error) {
    console.error('Shops error:', error);
    res.status(500).json({ error: 'Failed to load shops.' });
  }
});

/**
 * GET /api/shops/suggestions
 * Get product category suggestions for autocomplete
 */
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const shops = await prisma.shop.findMany({
      select: { categories: true },
    });

    // Flatten and deduplicate categories
    const allCategories = [...new Set(shops.flatMap(s => s.categories))].sort();

    res.json({ suggestions: allCategories });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Failed to load suggestions.' });
  }
});

/**
 * GET /api/shops/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: req.params.id },
    });

    if (!shop) return res.status(404).json({ error: 'Shop not found.' });
    res.json({ shop });
  } catch (error) {
    console.error('Shop detail error:', error);
    res.status(500).json({ error: 'Failed to load shop.' });
  }
});

/**
 * POST /api/shops
 * Add a shop (any user can add their own shop)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, address, contact, categories, description } = req.body;

    if (!name || !address || !contact) {
      return res.status(400).json({ error: 'Name, address, and contact are required.' });
    }

    const shop = await prisma.shop.create({
      data: {
        name,
        address,
        contact,
        categories: (categories || []).map(c => c.toLowerCase()),
        description: description || null,
        ownerId: req.user.id,
      },
    });

    res.status(201).json({ message: 'Shop added!', shop });
  } catch (error) {
    console.error('Add shop error:', error);
    res.status(500).json({ error: 'Failed to add shop.' });
  }
});

/**
 * PUT /api/shops/:id (Owner or Admin)
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found.' });
    
    // Check ownership or admin
    if (shop.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only edit your own shop.' });
    }

    const { name, address, contact, categories, description } = req.body;

    const updated = await prisma.shop.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(contact && { contact }),
        ...(categories && { categories: categories.map(c => c.toLowerCase()) }),
        ...(description !== undefined && { description }),
      },
    });

    res.json({ message: 'Shop updated.', shop: updated });
  } catch (error) {
    console.error('Update shop error:', error);
    res.status(500).json({ error: 'Failed to update shop.' });
  }
});

/**
 * DELETE /api/shops/:id (Owner or Admin)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found.' });
    
    // Check ownership or admin
    if (shop.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only delete your own shop.' });
    }

    await prisma.shop.delete({ where: { id: req.params.id } });
    res.json({ message: 'Shop deleted.' });
  } catch (error) {
    console.error('Delete shop error:', error);
    res.status(500).json({ error: 'Failed to delete shop.' });
  }
});

module.exports = router;
