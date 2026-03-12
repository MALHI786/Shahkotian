const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');
const { uploadToCloudinary, uploadVideoToCloudinary } = require('../utils/cloudinaryUpload');
const { upload, uploadMedia } = require('../utils/upload');

const router = express.Router();

// Predefined bazars for Shahkot
const DEFAULT_BAZARS = [
  'Sangla Bazar', 'Manawala Bazar', 'Faisalabad Bazar',
  'Darbar Road Bazar', 'Jaranwala Bazar', 'Nankana Road Bazar',
  '90 Chitti Road Bazar', 'College Road Bazar',
];

// ============ SEED BAZARS ============
async function seedBazars() {
  for (const name of DEFAULT_BAZARS) {
    const existing = await prisma.bazar.findFirst({ where: { name } });
    if (!existing) {
      await prisma.bazar.create({ data: { name } });
    }
  }
}
// Seed on first load
seedBazars().catch(err => console.error('Bazar seed error:', err));

// ============ PUBLIC: LIST BAZARS ============
router.get('/bazars', authenticate, async (req, res) => {
  try {
    const bazars = await prisma.bazar.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { traders: { where: { status: 'APPROVED' } } } } },
    });
    res.json({ bazars });
  } catch (error) {
    console.error('List bazars error:', error);
    res.status(500).json({ error: 'Failed to load bazars.' });
  }
});

// ============ TRADER REGISTRATION ============
router.post('/register', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const { fullName, shopName, phone, bazarId } = req.body;
    if (!fullName || !shopName || !phone || !bazarId) {
      return res.status(400).json({ error: 'Full name, shop name, phone and bazar are required.' });
    }

    // Check if user already registered as trader
    const existing = await prisma.trader.findUnique({ where: { userId: req.user.id } });
    if (existing) {
      return res.status(400).json({ error: 'You are already registered as a trader.', trader: existing });
    }

    // Verify bazar exists
    const bazar = await prisma.bazar.findUnique({ where: { id: bazarId } });
    if (!bazar) return res.status(404).json({ error: 'Bazar not found.' });

    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadToCloudinary(req.file, 'shahkot/traders');
    }

    const trader = await prisma.trader.create({
      data: {
        userId: req.user.id,
        fullName,
        shopName,
        phone,
        photoUrl,
        bazarId,
        status: 'PENDING',
      },
      include: { bazar: true },
    });

    res.status(201).json({ trader, message: 'Registration submitted. Awaiting approval.' });
  } catch (error) {
    console.error('Trader register error:', error);
    res.status(500).json({ error: 'Failed to register.' });
  }
});

// ============ MY TRADER STATUS ============
router.get('/my-status', authenticate, async (req, res) => {
  try {
    const trader = await prisma.trader.findUnique({
      where: { userId: req.user.id },
      include: { bazar: true },
    });
    res.json({ trader });
  } catch (error) {
    console.error('My status error:', error);
    res.status(500).json({ error: 'Failed to fetch status.' });
  }
});

// ============ TRADERS BY BAZAR ============
router.get('/traders/:bazarId', authenticate, async (req, res) => {
  try {
    const traders = await prisma.trader.findMany({
      where: { bazarId: req.params.bazarId, status: 'APPROVED' },
      orderBy: { shopName: 'asc' },
      include: { bazar: true },
    });
    res.json({ traders });
  } catch (error) {
    console.error('Traders by bazar error:', error);
    res.status(500).json({ error: 'Failed to load traders.' });
  }
});

// ============ SEARCH TRADERS ============
router.get('/traders/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ traders: [] });

    const traders = await prisma.trader.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { shopName: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { bazar: true },
      take: 20,
    });
    res.json({ traders });
  } catch (error) {
    console.error('Search traders error:', error);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// ============ BAZAR CHAT: GET MESSAGES ============
router.get('/chat/messages', authenticate, async (req, res) => {
  try {
    const { bazarId, page = 1 } = req.query;
    if (!bazarId) return res.status(400).json({ error: 'bazarId is required.' });

    const pageSize = 30;
    const skip = (parseInt(page) - 1) * pageSize;

    const messages = await prisma.bazarChatMessage.findMany({
      where: { bazarId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        trader: { select: { id: true, fullName: true, shopName: true, photoUrl: true, bazarId: true } },
      },
    });

    res.json({ messages: messages.reverse(), page: parseInt(page), hasMore: messages.length === pageSize });
  } catch (error) {
    console.error('Chat messages error:', error);
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

// ============ BAZAR CHAT: SEND MESSAGE ============
router.post('/chat/send', authenticate, uploadMedia.fields([
  { name: 'images', maxCount: 5 },
  { name: 'videos', maxCount: 2 },
  { name: 'voice', maxCount: 1 },
]), async (req, res) => {
  try {
    // Verify sender is an approved trader
    const trader = await prisma.trader.findUnique({ where: { userId: req.user.id } });
    if (!trader || trader.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Only approved traders can send messages.' });
    }

    const { text, bazarId, voiceDuration } = req.body;
    if (!bazarId) return res.status(400).json({ error: 'bazarId is required.' });

    // Upload media
    let imageUrls = [];
    let videoUrls = [];
    let voiceUrl = null;

    if (req.files?.images) {
      for (const file of req.files.images) {
        const url = await uploadToCloudinary(file, 'shahkot/bazar-chat');
        imageUrls.push(url);
      }
    }
    if (req.files?.videos) {
      for (const file of req.files.videos) {
        const url = await uploadVideoToCloudinary(file, 'shahkot/bazar-chat/videos');
        videoUrls.push(url);
      }
    }
    if (req.files?.voice?.[0]) {
      voiceUrl = await uploadToCloudinary(req.files.voice[0], 'shahkot/bazar-chat/voice');
    }

    const message = await prisma.bazarChatMessage.create({
      data: {
        traderId: trader.id,
        bazarId,
        text: text || null,
        images: imageUrls,
        videos: videoUrls,
        voiceUrl,
        voiceDuration: voiceDuration ? parseInt(voiceDuration) : null,
      },
      include: {
        trader: { select: { id: true, fullName: true, shopName: true, photoUrl: true, bazarId: true } },
      },
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send chat error:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// ============ BAZAR CHAT: CREATE POLL ============
router.post('/chat/poll', authenticate, async (req, res) => {
  try {
    const trader = await prisma.trader.findUnique({ where: { userId: req.user.id } });
    if (!trader || trader.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Only approved traders can create polls.' });
    }

    const { bazarId, pollQuestion, pollOptions } = req.body;
    if (!bazarId || !pollQuestion || !pollOptions || pollOptions.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required.' });
    }

    const message = await prisma.bazarChatMessage.create({
      data: {
        traderId: trader.id,
        bazarId,
        pollQuestion,
        pollOptions,
        pollVotes: [],
      },
      include: {
        trader: { select: { id: true, fullName: true, shopName: true, photoUrl: true, bazarId: true } },
      },
    });

    res.status(201).json({ message });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Failed to create poll.' });
  }
});

// ============ BAZAR CHAT: VOTE ON POLL ============
router.post('/chat/poll/:id/vote', authenticate, async (req, res) => {
  try {
    const trader = await prisma.trader.findUnique({ where: { userId: req.user.id } });
    if (!trader || trader.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Only approved traders can vote.' });
    }

    const { optionIndex } = req.body;
    if (typeof optionIndex !== 'number') {
      return res.status(400).json({ error: 'optionIndex is required.' });
    }

    const msg = await prisma.bazarChatMessage.findUnique({ where: { id: req.params.id } });
    if (!msg || !msg.pollQuestion) {
      return res.status(404).json({ error: 'Poll not found.' });
    }

    // Check if already voted
    const votes = msg.pollVotes || [];
    const alreadyVoted = votes.some(v => v.startsWith(`${trader.id}:`));
    if (alreadyVoted) {
      return res.status(400).json({ error: 'You have already voted.' });
    }

    const updatedVotes = [...votes, `${trader.id}:${optionIndex}`];
    const updated = await prisma.bazarChatMessage.update({
      where: { id: req.params.id },
      data: { pollVotes: updatedVotes },
      include: {
        trader: { select: { id: true, fullName: true, shopName: true, photoUrl: true, bazarId: true } },
      },
    });

    res.json({ message: updated });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to vote.' });
  }
});

// ============ DELETE CHAT MESSAGE (own or admin/president) ============
router.delete('/chat/messages/:id', authenticate, async (req, res) => {
  try {
    const msg = await prisma.bazarChatMessage.findUnique({
      where: { id: req.params.id },
      include: { trader: true },
    });
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    // Allow own message or admin
    if (msg.trader.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    await prisma.bazarChatMessage.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message.' });
  }
});

// ============ ADMIN/PRESIDENT: PENDING TRADERS ============
router.get('/pending', authenticate, async (req, res) => {
  try {
    // Allow admin or president
    if (req.user.role !== 'ADMIN') {
      // Check president token
      const presidentToken = req.headers['x-president-token'];
      if (!presidentToken) return res.status(403).json({ error: 'Access denied.' });
      try {
        jwt.verify(presidentToken, process.env.JWT_SECRET);
      } catch { return res.status(403).json({ error: 'Invalid president token.' }); }
    }

    const traders = await prisma.trader.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { bazar: true, user: { select: { name: true, email: true, phone: true } } },
    });
    res.json({ traders });
  } catch (error) {
    console.error('Pending traders error:', error);
    res.status(500).json({ error: 'Failed to load pending traders.' });
  }
});

// ============ ADMIN/PRESIDENT: APPROVE TRADER ============
router.put('/:id/approve', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      const presidentToken = req.headers['x-president-token'];
      if (!presidentToken) return res.status(403).json({ error: 'Access denied.' });
      try { jwt.verify(presidentToken, process.env.JWT_SECRET); }
      catch { return res.status(403).json({ error: 'Invalid president token.' }); }
    }

    const trader = await prisma.trader.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED' },
      include: { bazar: true },
    });
    res.json({ trader, message: 'Trader approved.' });
  } catch (error) {
    console.error('Approve trader error:', error);
    res.status(500).json({ error: 'Failed to approve.' });
  }
});

// ============ ADMIN/PRESIDENT: REJECT TRADER ============
router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      const presidentToken = req.headers['x-president-token'];
      if (!presidentToken) return res.status(403).json({ error: 'Access denied.' });
      try { jwt.verify(presidentToken, process.env.JWT_SECRET); }
      catch { return res.status(403).json({ error: 'Invalid president token.' }); }
    }

    const trader = await prisma.trader.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' },
      include: { bazar: true },
    });
    res.json({ trader, message: 'Trader rejected.' });
  } catch (error) {
    console.error('Reject trader error:', error);
    res.status(500).json({ error: 'Failed to reject.' });
  }
});

// ============ ADMIN/PRESIDENT: DELETE TRADER ============
router.delete('/trader/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      const presidentToken = req.headers['x-president-token'];
      if (!presidentToken) return res.status(403).json({ error: 'Access denied.' });
      try { jwt.verify(presidentToken, process.env.JWT_SECRET); }
      catch { return res.status(403).json({ error: 'Invalid president token.' }); }
    }

    await prisma.trader.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Trader deleted.' });
  } catch (error) {
    console.error('Delete trader error:', error);
    res.status(500).json({ error: 'Failed to delete.' });
  }
});

// ============ ADMIN: ADD BAZAR ============
router.post('/bazars', authenticate, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Bazar name is required.' });

    const existing = await prisma.bazar.findFirst({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Bazar already exists.' });

    const bazar = await prisma.bazar.create({ data: { name } });
    res.status(201).json({ bazar });
  } catch (error) {
    console.error('Add bazar error:', error);
    res.status(500).json({ error: 'Failed to add bazar.' });
  }
});

// ============ ADMIN: DELETE BAZAR ============
router.delete('/bazars/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await prisma.bazar.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Bazar deleted.' });
  } catch (error) {
    console.error('Delete bazar error:', error);
    res.status(500).json({ error: 'Failed to delete bazar.' });
  }
});

// ============ PRESIDENT AUTH ============
router.post('/president/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const president = await prisma.president.findUnique({ where: { email } });
    if (!president) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!president.isActive) return res.status(403).json({ error: 'Account deactivated.' });

    const valid = await bcrypt.compare(password, president.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ presidentId: president.id, role: 'PRESIDENT' }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      president: { id: president.id, name: president.name, email: president.email },
    });
  } catch (error) {
    console.error('President login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// ============ PRESIDENT DASHBOARD ============
router.get('/president/dashboard', authenticate, async (req, res) => {
  try {
    const presidentToken = req.headers['x-president-token'];
    if (!presidentToken) return res.status(403).json({ error: 'President token required.' });

    let decoded;
    try { decoded = jwt.verify(presidentToken, process.env.JWT_SECRET); }
    catch { return res.status(403).json({ error: 'Invalid president token.' }); }

    const president = await prisma.president.findUnique({ where: { id: decoded.presidentId } });
    if (!president) return res.status(404).json({ error: 'President not found.' });

    const [totalTraders, pendingTraders, approvedTraders, totalBazars, totalMessages] = await Promise.all([
      prisma.trader.count(),
      prisma.trader.count({ where: { status: 'PENDING' } }),
      prisma.trader.count({ where: { status: 'APPROVED' } }),
      prisma.bazar.count({ where: { isActive: true } }),
      prisma.bazarChatMessage.count(),
    ]);

    res.json({
      president: { id: president.id, name: president.name, email: president.email },
      stats: { totalTraders, pendingTraders, approvedTraders, totalBazars, totalMessages },
    });
  } catch (error) {
    console.error('President dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
});

// ============ ADMIN: CREATE PRESIDENT ============
router.post('/president/create', authenticate, adminOnly, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required.' });
    }

    const existing = await prisma.president.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'President with this email already exists.' });

    const hashed = await bcrypt.hash(password, 10);
    const president = await prisma.president.create({
      data: { email, password: hashed, name },
    });

    res.status(201).json({
      president: { id: president.id, name: president.name, email: president.email },
      message: 'President account created.',
    });
  } catch (error) {
    console.error('Create president error:', error);
    res.status(500).json({ error: 'Failed to create president.' });
  }
});

// ============ ADMIN: LIST ALL TRADERS ============
router.get('/all-traders', authenticate, adminOnly, async (req, res) => {
  try {
    const traders = await prisma.trader.findMany({
      orderBy: { createdAt: 'desc' },
      include: { bazar: true, user: { select: { name: true, email: true, phone: true } } },
    });
    res.json({ traders });
  } catch (error) {
    console.error('All traders error:', error);
    res.status(500).json({ error: 'Failed to load traders.' });
  }
});

module.exports = router;
