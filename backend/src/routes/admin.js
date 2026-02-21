const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { sendRishtaApprovalEmail, sendRishtaRejectionEmail } = require('../utils/email');
const { deleteFromCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(adminOnly);

// ============ DASHBOARD ============

/**
 * GET /api/admin/dashboard
 * Get admin dashboard stats
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalPosts,
      totalListings,
      totalTournaments,
      pendingRishta,
      totalNews,
      totalShops,
      totalOffices,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.listing.count(),
      prisma.tournament.count(),
      prisma.rishtaProfile.count({ where: { status: 'PENDING' } }),
      prisma.news.count(),
      prisma.shop.count(),
      prisma.govtOffice.count(),
    ]);

    res.json({
      stats: {
        totalUsers,
        totalPosts,
        totalListings,
        totalTournaments,
        pendingRishta,
        totalNews,
        totalShops,
        totalOffices,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

// ============ USER MANAGEMENT ============

/**
 * GET /api/admin/users
 * Get all users
 */
router.get('/users', async (req, res) => {
  try {
    const { search, role, page = 1 } = req.query;
    const limit = 50;

    const where = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (parseInt(page) - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { posts: true, listings: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: { page: parseInt(page), limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

/**
 * PUT /api/admin/users/:id/toggle-active
 * Activate/deactivate a user
 */
router.put('/users/:id/toggle-active', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
    });

    res.json({
      message: `User ${updated.isActive ? 'activated' : 'deactivated'}.`,
      user: { id: updated.id, name: updated.name, isActive: updated.isActive },
    });
  } catch (error) {
    console.error('Toggle user error:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// ============ RISHTA MANAGEMENT ============

/**
 * GET /api/admin/rishta/pending
 * Get pending Rishta applications
 */
router.get('/rishta/pending', async (req, res) => {
  try {
    const profiles = await prisma.rishtaProfile.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    res.json({ profiles, count: profiles.length });
  } catch (error) {
    console.error('Pending rishta error:', error);
    res.status(500).json({ error: 'Failed to load pending profiles.' });
  }
});

/**
 * PUT /api/admin/rishta/:id/approve
 * Approve a Rishta profile
 */
router.put('/rishta/:id/approve', async (req, res) => {
  try {
    const profile = await prisma.rishtaProfile.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    // Update profile status
    await prisma.rishtaProfile.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    // Update user role to VERIFIED_USER
    await prisma.user.update({
      where: { id: profile.userId },
      data: { role: 'VERIFIED_USER' },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: profile.userId,
        title: 'Rishta Profile Approved! ✅',
        body: 'Congratulations! Your Rishta profile has been approved. You can now browse and connect with other verified profiles.',
      },
    });

    // Send email notification
    if (profile.user.email) {
      await sendRishtaApprovalEmail(profile.user.email, profile.user.name);
    }

    res.json({ message: 'Rishta profile approved and user notified via email.' });
  } catch (error) {
    console.error('Approve rishta error:', error);
    res.status(500).json({ error: 'Failed to approve profile.' });
  }
});

/**
 * PUT /api/admin/rishta/:id/reject
 * Reject a Rishta profile
 */
router.put('/rishta/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;

    const profile = await prisma.rishtaProfile.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    await prisma.rishtaProfile.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        adminNote: reason || 'Profile did not meet verification requirements.',
      },
    });

    // Notification
    await prisma.notification.create({
      data: {
        userId: profile.userId,
        title: 'Rishta Profile Update',
        body: reason || 'Your Rishta profile was not approved. Please review and resubmit.',
      },
    });

    // Send email
    if (profile.user.email) {
      await sendRishtaRejectionEmail(profile.user.email, profile.user.name, reason);
    }

    res.json({ message: 'Rishta profile rejected.' });
  } catch (error) {
    console.error('Reject rishta error:', error);
    res.status(500).json({ error: 'Failed to reject profile.' });
  }
});

// ============ NEWS REPORTER MANAGEMENT ============

/**
 * GET /api/admin/reporters
 * Get all news reporters
 */
router.get('/reporters', async (req, res) => {
  try {
    const reporters = await prisma.newsReporter.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        _count: { select: { news: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reporters });
  } catch (error) {
    console.error('Reporters error:', error);
    res.status(500).json({ error: 'Failed to load reporters.' });
  }
});

/**
 * POST /api/admin/reporters
 * Add a new news reporter (admin sets their email + password)
 */
router.post('/reporters', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    // Check if email already exists
    const existing = await prisma.newsReporter.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Reporter with this email already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const reporter = await prisma.newsReporter.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: `Reporter "${name}" added! They can login with email: ${email}`,
      reporter,
    });
  } catch (error) {
    console.error('Add reporter error:', error);
    res.status(500).json({ error: 'Failed to add reporter.' });
  }
});

/**
 * PUT /api/admin/reporters/:id/toggle-active
 * Enable/disable a reporter
 */
router.put('/reporters/:id/toggle-active', async (req, res) => {
  try {
    const reporter = await prisma.newsReporter.findUnique({ where: { id: req.params.id } });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found.' });

    const updated = await prisma.newsReporter.update({
      where: { id: req.params.id },
      data: { isActive: !reporter.isActive },
    });

    res.json({
      message: `Reporter ${updated.isActive ? 'enabled' : 'disabled'}.`,
    });
  } catch (error) {
    console.error('Toggle reporter error:', error);
    res.status(500).json({ error: 'Failed to update reporter.' });
  }
});

/**
 * DELETE /api/admin/reporters/:id
 * Remove a reporter
 */
router.delete('/reporters/:id', async (req, res) => {
  try {
    await prisma.newsReporter.delete({ where: { id: req.params.id } });
    res.json({ message: 'Reporter removed.' });
  } catch (error) {
    console.error('Delete reporter error:', error);
    res.status(500).json({ error: 'Failed to remove reporter.' });
  }
});

// ============ CONTENT MODERATION ============

/**
 * DELETE /api/admin/posts/:id
 * Delete any post (moderation)
 */
router.delete('/posts/:id', async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post removed by admin.' });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

/**
 * DELETE /api/admin/listings/:id
 * Delete any listing (moderation)
 */
router.delete('/listings/:id', async (req, res) => {
  try {
    await prisma.listing.delete({ where: { id: req.params.id } });
    res.json({ message: 'Listing removed by admin.' });
  } catch (error) {
    console.error('Admin delete listing error:', error);
    res.status(500).json({ error: 'Failed to delete listing.' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user and all related data
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { userId: id } }),
      prisma.comment.deleteMany({ where: { userId: id } }),
      prisma.chatMessage.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.rishtaProfile.deleteMany({ where: { userId: id } }),
      prisma.post.deleteMany({ where: { userId: id } }),
      prisma.listing.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    res.json({ message: 'User and related data deleted.' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

/**
 * DELETE /api/admin/comments/:id
 */
router.delete('/comments/:id', async (req, res) => {
  try {
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Comment deleted.' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

/**
 * DELETE /api/admin/chat-messages/:id
 */
router.delete('/chat-messages/:id', async (req, res) => {
  try {
    await prisma.chatMessage.delete({ where: { id: req.params.id } });
    res.json({ message: 'Chat message deleted.' });
  } catch (error) {
    console.error('Delete chat message error:', error);
    res.status(500).json({ error: 'Failed to delete chat message.' });
  }
});

// Bulk delete chat messages older than X days
router.delete('/chat-messages-bulk', async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays, 10));
    const result = await prisma.chatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
    res.json({ message: `Deleted ${result.count} chat messages older than ${olderThanDays} days.` });
  } catch (error) {
    console.error('Bulk chat delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete chat messages.' });
  }
});

// Bulk delete notifications older than X days
router.delete('/notifications-bulk', async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.body;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays, 10));
    const result = await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });
    res.json({ message: `Deleted ${result.count} notifications older than ${olderThanDays} days.` });
  } catch (error) {
    console.error('Bulk notifications delete error:', error);
    res.status(500).json({ error: 'Failed to bulk delete notifications.' });
  }
});

// Storage info endpoint
router.get('/storage', async (req, res) => {
  try {
    const [users, posts, listings, comments, likes, chatMessages, news, tournaments, shops, govtOffices, rishtaProfiles, notifications] = await Promise.all([
      prisma.user.count(), prisma.post.count(), prisma.listing.count(), prisma.comment.count(), prisma.like.count(), prisma.chatMessage.count(), prisma.news.count(), prisma.tournament.count(), prisma.shop.count(), prisma.govtOffice.count(), prisma.rishtaProfile.count(), prisma.notification.count()
    ]);

    let dbSizeMB = -1;
    try {
      const result = await prisma.$queryRaw`SELECT pg_database_size(current_database()) as size`;
      dbSizeMB = Math.round((Number(result[0].size) / (1024 * 1024)) * 100) / 100;
    } catch (e) { dbSizeMB = -1; }

    res.json({ databaseSizeMB: dbSizeMB, totals: { users, posts, listings, comments, likes, chatMessages, news, tournaments, shops, govtOffices, rishtaProfiles, notifications } });
  } catch (error) {
    console.error('Storage info error:', error);
    res.status(500).json({ error: 'Failed to get storage info.' });
  }
});

// ============ NEWS DELETION ============
router.delete('/news/:id', async (req, res) => {
  try {
    const item = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'News not found.' });
    if (item.images?.length) {
      for (const url of item.images) { try { await deleteFromCloudinary(url); } catch (_) {} }
    }
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ message: 'News article deleted.' });
  } catch (error) {
    console.error('Admin delete news error:', error);
    res.status(500).json({ error: 'Failed to delete news.' });
  }
});

// ============ TOURNAMENT DELETION ============
router.delete('/tournaments/:id', async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.match.deleteMany({ where: { tournamentId: req.params.id } }),
      prisma.tournament.delete({ where: { id: req.params.id } }),
    ]);
    res.json({ message: 'Tournament and matches deleted.' });
  } catch (error) {
    console.error('Admin delete tournament error:', error);
    res.status(500).json({ error: 'Failed to delete tournament.' });
  }
});

// ============ RISHTA DELETION ============
router.delete('/rishta/:id', async (req, res) => {
  try {
    const profile = await prisma.rishtaProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) return res.status(404).json({ error: 'Rishta profile not found.' });
    const allImages = [...(profile.images || [])];
    if (profile.cnicFront) allImages.push(profile.cnicFront);
    if (profile.cnicBack) allImages.push(profile.cnicBack);
    for (const url of allImages) { try { await deleteFromCloudinary(url); } catch (_) {} }
    await prisma.rishtaProfile.delete({ where: { id: req.params.id } });
    res.json({ message: 'Rishta profile deleted.' });
  } catch (error) {
    console.error('Admin delete rishta error:', error);
    res.status(500).json({ error: 'Failed to delete rishta profile.' });
  }
});

// ============ GENERAL CLEANUP ============
router.post('/cleanup', async (req, res) => {
  try {
    const { target, olderThanDays = 30 } = req.body;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays, 10));
    let deletedCount = 0;
    switch (target) {
      case 'notifications': { const r = await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } }); deletedCount = r.count; break; }
      case 'chatMessages': { const r = await prisma.chatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } }); deletedCount = r.count; break; }
      case 'likes': { const r = await prisma.like.deleteMany({ where: { createdAt: { lt: cutoff } } }); deletedCount = r.count; break; }
      case 'comments': { const r = await prisma.comment.deleteMany({ where: { createdAt: { lt: cutoff } } }); deletedCount = r.count; break; }
      case 'all-old': {
        const results = await prisma.$transaction([
          prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } }),
          prisma.chatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } }),
        ]);
        deletedCount = results.reduce((s, r) => s + r.count, 0);
        break;
      }
      default: return res.status(400).json({ error: 'Invalid target.' });
    }
    res.json({ message: `Cleaned up ${deletedCount} records.`, deletedCount });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup.' });
  }
});

module.exports = router;

