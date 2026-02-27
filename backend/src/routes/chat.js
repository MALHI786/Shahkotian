const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { uploadAudioToCloudinary } = require('../utils/cloudinaryUpload');

// Get chat messages (paginated)
router.get('/messages', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [messages, total] = await Promise.all([
            prisma.chatMessage.findMany({
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, photoUrl: true } },
                    replyTo: {
                        include: {
                            user: { select: { id: true, name: true } },
                        },
                    },
                },
            }),
            prisma.chatMessage.count(),
        ]);

        res.json({
            messages: messages.reverse(),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Upload voice message — accepts base64 audio from React Native
router.post('/voice', authenticate, async (req, res) => {
    try {
        const { audioBase64 } = req.body;
        if (!audioBase64) return res.status(400).json({ error: 'No audio data provided' });

        const buffer = Buffer.from(audioBase64, 'base64');
        console.log(`Voice upload: received ${(buffer.length / 1024).toFixed(1)}KB audio`);
        const url = await uploadAudioToCloudinary(buffer);
        console.log('Voice uploaded to:', url);
        res.json({ voiceUrl: url });
    } catch (error) {
        console.error('Voice upload error:', error);
        res.status(500).json({ error: 'Failed to upload voice message' });
    }
});

// Send message
router.post('/messages', authenticate, async (req, res) => {
    try {
        const { text, images = [], videos = [], voiceUrl, voiceDuration, replyToId } = req.body;

        if (!text && images.length === 0 && videos.length === 0 && !voiceUrl) {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        // Check if user is blocked
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user.isBlocked) {
            return res.status(403).json({ error: 'You have been blocked from chatting' });
        }

        const message = await prisma.chatMessage.create({
            data: {
                userId: req.user.id,
                text: text || null,
                images,
                videos,
                voiceUrl: voiceUrl || null,
                voiceDuration: voiceDuration ? parseInt(voiceDuration) : null,
                replyToId: replyToId || null,
            },
            include: {
                user: { select: { id: true, name: true, photoUrl: true } },
                replyTo: {
                    include: {
                        user: { select: { id: true, name: true } },
                    },
                },
            },
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Send chat message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Get user profile (photo only, no phone)
router.get('/user/:userId', authenticate, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.userId },
            select: { id: true, name: true, photoUrl: true, createdAt: true },
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// Delete own chat message (sender only)
router.delete('/messages/:messageId', authenticate, async (req, res) => {
    try {
        const message = await prisma.chatMessage.findUnique({
            where: { id: req.params.messageId },
        });
        if (!message) return res.status(404).json({ error: 'Message not found' });
        if (message.userId !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own messages.' });
        }

        await prisma.chatMessage.delete({ where: { id: req.params.messageId } });
        res.json({ message: 'Message deleted.' });
    } catch (error) {
        console.error('Delete chat message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Report a chat message
router.post('/report', authenticate, async (req, res) => {
    try {
        const { messageId, reason } = req.body;

        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId },
        });
        if (!message) return res.status(404).json({ error: 'Message not found' });

        await prisma.report.create({
            data: {
                reporterUserId: req.user.id,
                targetUserId: message.userId,
                targetType: 'CHAT_MESSAGE',
                targetId: messageId,
                reason: reason || 'Inappropriate content',
            },
        });

        res.json({ message: 'Report submitted successfully' });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

module.exports = router;
