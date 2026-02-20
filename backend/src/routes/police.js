const express = require('express');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { upload } = require('../utils/upload');
const { uploadMultipleToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

/**
 * GET /api/police/announcements
 * Get all police announcements
 */
router.get('/announcements', authenticate, async (req, res) => {
  try {
    const { category, urgent } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const where = {};
    if (category) where.category = category;
    if (urgent === 'true') where.isUrgent = true;

    const [announcements, total] = await Promise.all([
      prisma.policeAnnouncement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { isUrgent: 'desc' },
          { createdAt: 'desc' }
        ],
      }),
      prisma.policeAnnouncement.count({ where }),
    ]);

    res.json({
      announcements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Police announcements error:', error);
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

/**
 * GET /api/police/announcements/:id
 * Get single announcement
 */
router.get('/announcements/:id', authenticate, async (req, res) => {
  try {
    const announcement = await prisma.policeAnnouncement.findUnique({
      where: { id: req.params.id },
    });

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    res.json({ announcement });
  } catch (error) {
    console.error('Announcement detail error:', error);
    res.status(500).json({ error: 'Failed to load announcement.' });
  }
});

/**
 * POST /api/police/announcements
 * Create announcement (admin only)
 */
router.post('/announcements', authenticate, adminOnly, upload.array('images', 5), async (req, res) => {
  try {
    const { title, content, category, isUrgent, contactNumber } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    // Upload images
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = await uploadMultipleToCloudinary(req.files, 'police');
    }

    const announcement = await prisma.policeAnnouncement.create({
      data: {
        title,
        content,
        category: category || 'GENERAL',
        isUrgent: isUrgent === 'true' || isUrgent === true,
        contactNumber: contactNumber || null,
        images: imageUrls,
      },
    });

    res.status(201).json({
      message: 'Police announcement created.',
      announcement,
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement.' });
  }
});

/**
 * PUT /api/police/announcements/:id
 * Update announcement (admin only)
 */
router.put('/announcements/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { title, content, category, isUrgent, contactNumber } = req.body;

    const announcement = await prisma.policeAnnouncement.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(category && { category }),
        ...(isUrgent !== undefined && { isUrgent: isUrgent === 'true' || isUrgent === true }),
        ...(contactNumber !== undefined && { contactNumber }),
      },
    });

    res.json({ message: 'Announcement updated.', announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ error: 'Failed to update announcement.' });
  }
});

/**
 * DELETE /api/police/announcements/:id
 * Delete announcement (admin only)
 */
router.delete('/announcements/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await prisma.policeAnnouncement.delete({ where: { id: req.params.id } });
    res.json({ message: 'Announcement deleted.' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement.' });
  }
});

module.exports = router;
