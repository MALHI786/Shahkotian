const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/blood/donors
 * Search blood donors by blood group and urgency
 */
router.get('/donors', authenticate, async (req, res) => {
    try {
        const { bloodGroup, emergency, page = 1, limit = 20 } = req.query;

        const where = { isAvailable: true };
        if (bloodGroup) {
            where.bloodGroup = bloodGroup;
        }
        if (emergency === 'true') {
            where.isEmergency = true;
        }

        const [donors, total] = await Promise.all([
            prisma.bloodDonor.findMany({
                where,
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit),
                orderBy: [{ isEmergency: 'desc' }, { createdAt: 'desc' }],
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    whatsapp: true,
                    bloodGroup: true,
                    address: true,
                    lastDonated: true,
                    isAvailable: true,
                    isEmergency: true,
                },
            }),
            prisma.bloodDonor.count({ where }),
        ]);

        res.json({
            donors,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('Blood donors error:', error);
        res.status(500).json({ error: 'Failed to load blood donors.' });
    }
});

/**
 * GET /api/blood/groups
 * Get available blood groups for filtering
 */
router.get('/groups', authenticate, (req, res) => {
    const groups = [
        { key: 'A_POSITIVE', label: 'A+', color: '#EF4444' },
        { key: 'A_NEGATIVE', label: 'A-', color: '#DC2626' },
        { key: 'B_POSITIVE', label: 'B+', color: '#F97316' },
        { key: 'B_NEGATIVE', label: 'B-', color: '#EA580C' },
        { key: 'AB_POSITIVE', label: 'AB+', color: '#8B5CF6' },
        { key: 'AB_NEGATIVE', label: 'AB-', color: '#7C3AED' },
        { key: 'O_POSITIVE', label: 'O+', color: '#10B981' },
        { key: 'O_NEGATIVE', label: 'O-', color: '#059669' },
    ];
    res.json({ groups });
});

/**
 * GET /api/blood/my-donation
 * Get current user's blood donor registration
 */
router.get('/my-donation', authenticate, async (req, res) => {
    try {
        const donor = await prisma.bloodDonor.findFirst({
            where: { userId: req.user.id },
        });
        res.json({ donor });
    } catch (error) {
        console.error('My donation error:', error);
        res.status(500).json({ error: 'Failed to load your donation status.' });
    }
});

/**
 * POST /api/blood/register
 * Register as a blood donor
 */
router.post('/register', authenticate, async (req, res) => {
    try {
        const { name, phone, whatsapp, bloodGroup, address, isEmergency } = req.body;

        if (!name || !phone || !bloodGroup) {
            return res.status(400).json({ error: 'Name, phone, and blood group are required.' });
        }

        // Check if user already registered
        const existing = await prisma.bloodDonor.findFirst({
            where: { userId: req.user.id },
        });

        if (existing) {
            return res.status(400).json({ error: 'You are already registered as a donor. Update your profile instead.' });
        }

        const donor = await prisma.bloodDonor.create({
            data: {
                userId: req.user.id,
                name,
                phone,
                whatsapp: whatsapp || null,
                bloodGroup,
                address: address || null,
                isAvailable: true,
                isEmergency: isEmergency || false,
            },
        });

        res.status(201).json({ message: 'Registered as blood donor!', donor });
    } catch (error) {
        console.error('Blood donor registration error:', error);
        res.status(500).json({ error: 'Failed to register as donor.' });
    }
});

/**
 * PUT /api/blood/update
 * Update blood donor profile
 */
router.put('/update', authenticate, async (req, res) => {
    try {
        const { name, phone, whatsapp, bloodGroup, address, isAvailable, isEmergency, lastDonated } = req.body;

        const existing = await prisma.bloodDonor.findFirst({
            where: { userId: req.user.id },
        });

        if (!existing) {
            return res.status(404).json({ error: 'You are not registered as a donor.' });
        }

        const donor = await prisma.bloodDonor.update({
            where: { id: existing.id },
            data: {
                ...(name && { name }),
                ...(phone && { phone }),
                ...(whatsapp !== undefined && { whatsapp }),
                ...(bloodGroup && { bloodGroup }),
                ...(address !== undefined && { address }),
                ...(isAvailable !== undefined && { isAvailable }),
                ...(isEmergency !== undefined && { isEmergency }),
                ...(lastDonated && { lastDonated: new Date(lastDonated) }),
            },
        });

        res.json({ message: 'Donor profile updated.', donor });
    } catch (error) {
        console.error('Blood donor update error:', error);
        res.status(500).json({ error: 'Failed to update donor profile.' });
    }
});

/**
 * DELETE /api/blood/unregister
 * Remove from blood donor list
 */
router.delete('/unregister', authenticate, async (req, res) => {
    try {
        const existing = await prisma.bloodDonor.findFirst({
            where: { userId: req.user.id },
        });

        if (!existing) {
            return res.status(404).json({ error: 'You are not registered as a donor.' });
        }

        await prisma.bloodDonor.delete({ where: { id: existing.id } });
        res.json({ message: 'Removed from blood donor list.' });
    } catch (error) {
        console.error('Blood donor unregister error:', error);
        res.status(500).json({ error: 'Failed to unregister.' });
    }
});

module.exports = router;
