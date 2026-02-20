const express = require('express');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/govt-offices
 * Get all government offices
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const offices = await prisma.govtOffice.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json({ offices });
  } catch (error) {
    console.error('Govt offices error:', error);
    res.status(500).json({ error: 'Failed to load govt offices.' });
  }
});

/**
 * GET /api/govt-offices/:id
 * Get single govt office details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const office = await prisma.govtOffice.findUnique({
      where: { id: req.params.id },
    });

    if (!office) {
      return res.status(404).json({ error: 'Office not found.' });
    }

    res.json({ office });
  } catch (error) {
    console.error('Govt office detail error:', error);
    res.status(500).json({ error: 'Failed to load office details.' });
  }
});

/**
 * POST /api/govt-offices (ADMIN ONLY)
 * Add a government office
 */
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, address, latitude, longitude, helplines, timings, description } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required.' });
    }

    const office = await prisma.govtOffice.create({
      data: {
        name,
        address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        helplines: helplines || [],
        timings: timings || null,
        description: description || null,
      },
    });

    res.status(201).json({ message: 'Government office added!', office });
  } catch (error) {
    console.error('Add govt office error:', error);
    res.status(500).json({ error: 'Failed to add government office.' });
  }
});

/**
 * PUT /api/govt-offices/:id (ADMIN ONLY)
 * Update a government office
 */
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { name, address, latitude, longitude, helplines, timings, description } = req.body;

    const office = await prisma.govtOffice.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(latitude && { latitude: parseFloat(latitude) }),
        ...(longitude && { longitude: parseFloat(longitude) }),
        ...(helplines && { helplines }),
        ...(timings !== undefined && { timings }),
        ...(description !== undefined && { description }),
      },
    });

    res.json({ message: 'Government office updated.', office });
  } catch (error) {
    console.error('Update govt office error:', error);
    res.status(500).json({ error: 'Failed to update government office.' });
  }
});

/**
 * DELETE /api/govt-offices/:id (ADMIN ONLY)
 */
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await prisma.govtOffice.delete({ where: { id: req.params.id } });
    res.json({ message: 'Government office deleted.' });
  } catch (error) {
    console.error('Delete govt office error:', error);
    res.status(500).json({ error: 'Failed to delete government office.' });
  }
});

module.exports = router;
