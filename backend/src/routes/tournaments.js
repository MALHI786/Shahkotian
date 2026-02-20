const express = require('express');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { uploadSingle } = require('../utils/upload');
const { uploadToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

/**
 * GET /api/tournaments
 * Get all tournaments (optionally filter by sport)
 * Auto-filters out expired tournaments (endDate passed)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { sport, includeExpired } = req.query;
    const where = { 
      ...(sport ? { sport } : {}),
      // Auto-hide expired tournaments unless explicitly requested
      ...(includeExpired !== 'true' ? {
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } }
        ]
      } : {})
    };

    const tournaments = await prisma.tournament.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        _count: { select: { matches: true } },
      },
    });

    res.json({ tournaments });
  } catch (error) {
    console.error('Tournaments error:', error);
    res.status(500).json({ error: 'Failed to load tournaments.' });
  }
});

/**
 * GET /api/tournaments/sports
 * Get available sport categories
 */
router.get('/sports', authenticate, (req, res) => {
  const sports = [
    { key: 'CRICKET', label: 'Cricket', icon: '🏏' },
    { key: 'FOOTBALL', label: 'Football', icon: '⚽' },
    { key: 'KABADDI', label: 'Kabaddi', icon: '🤼' },
    { key: 'VOLLEYBALL', label: 'Volleyball', icon: '🏐' },
    { key: 'HOCKEY', label: 'Hockey', icon: '🏑' },
    { key: 'BADMINTON', label: 'Badminton', icon: '🏸' },
    { key: 'TABLE_TENNIS', label: 'Table Tennis', icon: '🏓' },
    { key: 'OTHER', label: 'Other', icon: '🏆' },
  ];
  res.json({ sports });
});

/**
 * GET /api/tournaments/:id
 * Get tournament details with schedule
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        matches: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' });
    }

    res.json({ tournament });
  } catch (error) {
    console.error('Tournament detail error:', error);
    res.status(500).json({ error: 'Failed to load tournament.' });
  }
});

/**
 * POST /api/tournaments (ADMIN ONLY)
 * Create a new tournament
 */
router.post('/', authenticate, adminOnly, (req, res) => {
  uploadSingle(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const { sport, name, description, venue, startDate, endDate } = req.body;

      if (!sport || !name || !description || !venue || !startDate) {
        return res.status(400).json({
          error: 'Sport, name, description, venue, and start date are required.',
        });
      }

      // Upload image if provided
      let imageUrl = null;
      if (req.file) {
        imageUrl = await uploadToCloudinary(req.file.buffer, 'tournaments');
      }

      const tournament = await prisma.tournament.create({
        data: {
          sport,
          name,
          description,
          image: imageUrl,
          venue,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
        },
      });

      res.status(201).json({ message: 'Tournament created!', tournament });
    } catch (error) {
      console.error('Create tournament error:', error);
      res.status(500).json({ error: 'Failed to create tournament.' });
    }
  });
});

/**
 * POST /api/tournaments/:id/matches (ADMIN ONLY)
 * Add a match to a tournament
 */
router.post('/:id/matches', authenticate, adminOnly, async (req, res) => {
  try {
    const { team1, team2, date, time, venue, result } = req.body;

    if (!team1 || !team2 || !date || !time || !venue) {
      return res.status(400).json({
        error: 'Team1, team2, date, time, and venue are required.',
      });
    }

    const match = await prisma.match.create({
      data: {
        tournamentId: req.params.id,
        team1,
        team2,
        date: new Date(date),
        time,
        venue,
        result: result || null,
      },
    });

    res.status(201).json({ message: 'Match added!', match });
  } catch (error) {
    console.error('Add match error:', error);
    res.status(500).json({ error: 'Failed to add match.' });
  }
});

/**
 * PUT /api/tournaments/:id (ADMIN ONLY)
 * Update tournament
 */
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { sport, name, description, venue, startDate, endDate } = req.body;

    const tournament = await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        ...(sport && { sport }),
        ...(name && { name }),
        ...(description && { description }),
        ...(venue && { venue }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
    });

    res.json({ message: 'Tournament updated.', tournament });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({ error: 'Failed to update tournament.' });
  }
});

/**
 * PUT /api/tournaments/matches/:matchId (ADMIN ONLY)
 * Update match result
 */
router.put('/matches/:matchId', authenticate, adminOnly, async (req, res) => {
  try {
    const { team1, team2, date, time, venue, result } = req.body;

    const match = await prisma.match.update({
      where: { id: req.params.matchId },
      data: {
        ...(team1 && { team1 }),
        ...(team2 && { team2 }),
        ...(date && { date: new Date(date) }),
        ...(time && { time }),
        ...(venue && { venue }),
        ...(result !== undefined && { result }),
      },
    });

    res.json({ message: 'Match updated.', match });
  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({ error: 'Failed to update match.' });
  }
});

/**
 * DELETE /api/tournaments/:id (Creator or Admin)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
    
    // Check ownership or admin
    if (tournament.createdById !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only delete tournaments you created.' });
    }

    await prisma.tournament.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tournament deleted.' });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({ error: 'Failed to delete tournament.' });
  }
});

/**
 * Auto-cleanup expired tournaments (called periodically or on load)
 * Deletes tournaments where endDate has passed
 */
router.delete('/cleanup/expired', authenticate, adminOnly, async (req, res) => {
  try {
    const deleted = await prisma.tournament.deleteMany({
      where: {
        endDate: { lt: new Date() }
      }
    });
    res.json({ message: `Deleted ${deleted.count} expired tournament(s).` });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup expired tournaments.' });
  }
});

module.exports = router;
