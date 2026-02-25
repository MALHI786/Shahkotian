const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        whatsapp: true,
        photoUrl: true,
        role: true,
        isActive: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    req.user = user;

    // Update lastSeenAt in background — do not await so request is not delayed
    prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(500).json({ error: 'Authentication error.' });
  }
}

/**
 * Admin-only middleware
 */
function adminOnly(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
}

/**
 * Verified user middleware (for Rishta)
 */
function verifiedOnly(req, res, next) {
  if (req.user.role !== 'VERIFIED_USER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Verified users only.' });
  }
  next();
}

/**
 * News reporter middleware
 */
function reporterOnly(req, res, next) {
  if (req.user.role !== 'NEWS_REPORTER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. News reporters only.' });
  }
  next();
}

module.exports = {
  authenticate,
  adminOnly,
  verifiedOnly,
  reporterOnly,
};
