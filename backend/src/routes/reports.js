const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
                    targetUser: { select: { id: true, name: true } },
                },
            }),
            prisma.report.count({
                where: status !== 'ALL' ? { status } : {},
            }),
        ]);

        res.json({
            reports,
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

        if (action === 'block' && report.targetUserId) {
            await prisma.user.update({
                where: { id: report.targetUserId },
                data: { isBlocked: true },
            });
            await prisma.report.update({
                where: { id: req.params.id },
                data: { status: 'BLOCKED' },
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
