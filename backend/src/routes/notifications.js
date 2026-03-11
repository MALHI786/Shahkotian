const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * PUT /api/notifications/fcm-token
 * Save or update the user's FCM device token for push notifications
 */
router.put('/fcm-token', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ error: 'Valid FCM token is required.' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken: token.trim() },
    });

    res.json({ message: 'FCM token saved.' });
  } catch (error) {
    console.error('Save FCM token error:', error);
    res.status(500).json({ error: 'Failed to save FCM token.' });
  }
});

/**
 * DELETE /api/notifications/fcm-token
 * Remove FCM token (on logout, so user stops receiving notifications)
 */
router.delete('/fcm-token', authenticate, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken: null },
    });
    res.json({ message: 'FCM token removed.' });
  } catch (error) {
    console.error('Remove FCM token error:', error);
    res.status(500).json({ error: 'Failed to remove FCM token.' });
  }
});

/**
 * GET /api/notifications
 * Get user's notifications (also auto-cleans notifications older than 30 days)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    // Auto-delete notifications older than 30 days (fire-and-forget)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    prisma.notification.deleteMany({
      where: { userId: req.user.id, createdAt: { lt: thirtyDaysAgo } },
    }).catch(() => {});

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
      prisma.notification.count({
        where: { userId: req.user.id, isRead: false },
      }),
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json({ message: 'Marked as read.' });
  } catch (error) {
    console.error('Read notification error:', error);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Read all error:', error);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

module.exports = router;
