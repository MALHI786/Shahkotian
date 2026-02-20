const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { sendRishtaApprovalEmail, sendRishtaRejectionEmail } = require('../utils/email');

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

module.exports = router;
