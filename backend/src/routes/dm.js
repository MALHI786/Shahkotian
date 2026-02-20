const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate } = require('../middleware/auth');

// Start a DM chat with a user
router.post('/start/:userId', authenticate, async (req, res) => {
    try {
        const otherUserId = req.params.userId;
        if (otherUserId === req.user.id) {
            return res.status(400).json({ error: 'Cannot start chat with yourself' });
        }

        // Check if chat already exists
        const existing = await prisma.dMChat.findFirst({
            where: {
                OR: [
                    { user1Id: req.user.id, user2Id: otherUserId },
                    { user1Id: otherUserId, user2Id: req.user.id },
                ],
            },
            include: {
                user1: { select: { id: true, name: true, photoUrl: true } },
                user2: { select: { id: true, name: true, photoUrl: true } },
            },
        });

        if (existing) return res.json(existing);

        const chat = await prisma.dMChat.create({
            data: {
                user1Id: req.user.id,
                user2Id: otherUserId,
            },
            include: {
                user1: { select: { id: true, name: true, photoUrl: true } },
                user2: { select: { id: true, name: true, photoUrl: true } },
            },
        });

        res.status(201).json(chat);
    } catch (error) {
        console.error('Start DM error:', error);
        res.status(500).json({ error: 'Failed to start chat' });
    }
});

// Get all DM chats for current user
router.get('/chats', authenticate, async (req, res) => {
    try {
        const chats = await prisma.dMChat.findMany({
            where: {
                OR: [
                    { user1Id: req.user.id },
                    { user2Id: req.user.id },
                ],
            },
            include: {
                user1: { select: { id: true, name: true, photoUrl: true } },
                user2: { select: { id: true, name: true, photoUrl: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { text: true, createdAt: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });

        res.json({ chats });
    } catch (error) {
        console.error('Get DM chats error:', error);
        res.status(500).json({ error: 'Failed to get chats' });
    }
});

// Get messages in a DM chat
router.get('/:chatId/messages', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Verify user is part of this chat
        const chat = await prisma.dMChat.findFirst({
            where: {
                id: req.params.chatId,
                OR: [
                    { user1Id: req.user.id },
                    { user2Id: req.user.id },
                ],
            },
        });
        if (!chat) return res.status(403).json({ error: 'Access denied' });

        const messages = await prisma.dMMessage.findMany({
            where: { chatId: req.params.chatId },
            skip,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            include: {
                sender: { select: { id: true, name: true, photoUrl: true } },
            },
        });

        res.json({ messages: messages.reverse() });
    } catch (error) {
        console.error('Get DM messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Send DM message
router.post('/:chatId/messages', authenticate, async (req, res) => {
    try {
        const { text, images = [] } = req.body;

        if (!text && images.length === 0) {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        // Check if user is blocked
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user.isBlocked) {
            return res.status(403).json({ error: 'You have been blocked' });
        }

        // Verify user is part of this chat
        const chat = await prisma.dMChat.findFirst({
            where: {
                id: req.params.chatId,
                OR: [
                    { user1Id: req.user.id },
                    { user2Id: req.user.id },
                ],
            },
        });
        if (!chat) return res.status(403).json({ error: 'Access denied' });

        const message = await prisma.dMMessage.create({
            data: {
                chatId: req.params.chatId,
                senderId: req.user.id,
                text: text || null,
                images,
            },
            include: {
                sender: { select: { id: true, name: true, photoUrl: true } },
            },
        });

        // Update chat timestamp
        await prisma.dMChat.update({
            where: { id: req.params.chatId },
            data: { updatedAt: new Date() },
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Send DM message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Report in DM → can lead to user block
router.post('/:chatId/report', authenticate, async (req, res) => {
    try {
        const { messageId, reason } = req.body;

        const message = await prisma.dMMessage.findUnique({
            where: { id: messageId },
        });
        if (!message) return res.status(404).json({ error: 'Message not found' });

        await prisma.report.create({
            data: {
                reporterUserId: req.user.id,
                targetUserId: message.senderId,
                targetType: 'DM_MESSAGE',
                targetId: messageId,
                reason: reason || 'Vulgar/inappropriate language',
            },
        });

        res.json({ message: 'Report submitted. Our admins will review it.' });
    } catch (error) {
        console.error('DM Report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

module.exports = router;
