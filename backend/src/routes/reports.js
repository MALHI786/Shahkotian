const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, adminOnly } = require('../middleware/auth');

// Submit a report (any user)
router.post('/', authenticate, async (req, res) => {
    try {
        const { targetType, targetId, targetUserId, reason } = req.body;

        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ error: 'targetType, targetId, and reason are required' });
        }

        const report = await prisma.report.create({
            data: {
                reporterUserId: req.user.id,
                targetType,
                targetId,
                targetUserId: targetUserId || null,
                reason,
            },
        });

        res.status(201).json({ message: 'Report submitted successfully', report });
    } catch (error) {
        console.error('Submit report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// Get all reports (admin only)
router.get('/', authenticate, adminOnly, async (req, res) => {
    try {
        const { status = 'PENDING', page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                where: status !== 'ALL' ? { status } : {},
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    reporter: { select: { id: true, name: true } },
                    target: { select: { id: true, name: true } },
                },
            }),
            prisma.report.count({
                where: status !== 'ALL' ? { status } : {},
            }),
        ]);

        // For each report, fetch last 5 context messages based on targetType
        const enriched = await Promise.all(reports.map(async (report) => {
            let contextMessages = [];
            try {
                if (report.targetType === 'CHAT_MESSAGE') {
                    // Open chat: fetch 5 messages around the reported one
                    const targetMsg = await prisma.chatMessage.findUnique({ where: { id: report.targetId } });
                    if (targetMsg) {
                        contextMessages = await prisma.chatMessage.findMany({
                            where: { createdAt: { lte: targetMsg.createdAt } },
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                            include: { user: { select: { id: true, name: true } } },
                        });
                        contextMessages = contextMessages.reverse();
                    }
                } else if (report.targetType === 'DM_MESSAGE') {
                    // Direct message: fetch last 5 DM messages from that chat
                    const targetDmMsg = await prisma.dMMessage.findUnique({ where: { id: report.targetId } });
                    if (targetDmMsg) {
                        contextMessages = await prisma.dMMessage.findMany({
                            where: { chatId: targetDmMsg.chatId, createdAt: { lte: targetDmMsg.createdAt } },
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                            include: { sender: { select: { id: true, name: true } } },
                        });
                        contextMessages = contextMessages.reverse().map(m => ({
                            ...m, user: m.sender, // normalize field name
                        }));
                    }
                }
            } catch (ctxErr) {
                console.error('Context messages error:', ctxErr.message);
            }
            return { ...report, contextMessages };
        }));

        res.json({
            reports: enriched,
            pagination: { page: parseInt(page), total, totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to get reports' });
    }
});

// Take action on a report (admin only)
router.put('/:id/action', authenticate, adminOnly, async (req, res) => {
    try {
        const { action } = req.body; // 'block' or 'dismiss'
        const report = await prisma.report.findUnique({ where: { id: req.params.id } });
        if (!report) return res.status(404).json({ error: 'Report not found' });

        const act = (action || '').toUpperCase();
        if (act === 'BLOCK' && report.targetUserId) {
            await prisma.user.update({
                where: { id: report.targetUserId },
                data: { isBlocked: true, isActive: false },
            });
            await prisma.report.update({
                where: { id: req.params.id },
                data: { status: 'RESOLVED' },
            });
            res.json({ message: 'User has been blocked' });
        } else {
            await prisma.report.update({
                where: { id: req.params.id },
                data: { status: 'DISMISSED' },
            });
            res.json({ message: 'Report dismissed' });
        }
    } catch (error) {
        console.error('Report action error:', error);
        res.status(500).json({ error: 'Failed to process report' });
    }
});

module.exports = router;
