const express = require('express');
const prisma = require('../config/database');
const { authenticate, verifiedOnly, adminOnly } = require('../middleware/auth');
const { upload, uploadRishta } = require('../utils/upload');
const { uploadImageFile, uploadMultipleImages } = require('../utils/imageUpload');
const { sendRishtaApprovalEmail, sendRishtaRejectionEmail } = require('../utils/email');

const router = express.Router();

// Agreement text that users must sign
const RISHTA_AGREEMENT = `I solemnly declare that all information provided in my Rishta profile is true and accurate. I understand that:

1. Any involvement in illegal activity, fraud, or misrepresentation will result in immediate account termination and legal action.
2. I will not use this platform for any purpose other than genuine matrimonial search.
3. I will respect the privacy and dignity of other users.
4. I understand that Shahkot App administration will cooperate with law enforcement if any complaint is filed.
5. My CNIC has been verified and I am solely responsible for the authenticity of my profile.

Violation of these terms will NOT be forgiven and strict legal action will be taken.`;

/**
 * GET /api/rishta/agreement
 * Get the agreement text before applying
 */
router.get('/agreement', authenticate, (req, res) => {
  res.json({ agreement: RISHTA_AGREEMENT });
});

/**
 * GET /api/rishta/my-profile
 * Get current user's Rishta profile status
 */
router.get('/my-profile', authenticate, async (req, res) => {
  try {
    const profile = await prisma.rishtaProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.json({ hasProfile: false, message: 'You have not created a Rishta profile yet.' });
    }

    res.json({ hasProfile: true, profile });
  } catch (error) {
    console.error('Rishta profile error:', error);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

/**
 * POST /api/rishta/apply
 * Create Rishta profile (requires CNIC, agreement, phone verification)
 */
router.post('/apply', authenticate, (req, res) => {
  uploadRishta(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const { age, gender, education, occupation, familyDetails, preferences, signatureAgreed } = req.body;

      // Accept boolean true or string 'true' from FormData
      const agreed = signatureAgreed === true || signatureAgreed === 'true';
      if (!agreed) {
        return res.status(400).json({
          error: 'You must agree to the terms and conditions to use the Rishta feature.',
        });
      }

      if (!age || !gender || !education || !occupation) {
        return res.status(400).json({
          error: 'Age, gender, education, and occupation are required.',
        });
      }

      if (!req.files || !req.files.cnicFront || !req.files.cnicBack) {
        return res.status(400).json({
          error: 'Both CNIC front and back images are required.',
        });
      }

      // Check if user already has a profile
      const existing = await prisma.rishtaProfile.findUnique({
        where: { userId: req.user.id },
      });

      if (existing) {
        return res.status(409).json({
          error: 'You already have a Rishta profile.',
          status: existing.status,
        });
      }

      // Upload CNIC images
      const cnicFrontUrl = await uploadImageFile(req.files.cnicFront[0]);
      const cnicBackUrl = await uploadImageFile(req.files.cnicBack[0]);

      // Upload optional personal photos
      let personalPhotoUrls = [];
      if (req.files.photos && req.files.photos.length > 0) {
        personalPhotoUrls = await uploadMultipleImages(req.files.photos);
      }

      // Create Rishta profile
      const profile = await prisma.rishtaProfile.create({
        data: {
          userId: req.user.id,
          cnicFront: cnicFrontUrl,
          cnicBack: cnicBackUrl,
          age: parseInt(age),
          gender,
          education,
          occupation,
          familyDetails: familyDetails || null,
          preferences: preferences || null,
          images: personalPhotoUrls,
          signatureAgreed: true,
          agreementText: RISHTA_AGREEMENT,
          status: 'PENDING',
        },
      });

      res.status(201).json({
        message: 'Rishta profile submitted! It will be reviewed by admin. You will receive an email upon approval.',
        profile: {
          id: profile.id,
          status: profile.status,
        },
      });
    } catch (error) {
      console.error('Rishta apply error:', error);
      res.status(500).json({ error: 'Failed to submit Rishta profile.' });
    }
  });
});

/**
 * POST /api/rishta/upload-photos
 * Upload profile photos for Rishta (only after approval, NO videos)
 */
router.post('/upload-photos', authenticate, verifiedOnly, upload.array('images', 5), async (req, res) => {
  try {
    const profile = await prisma.rishtaProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile || profile.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Your Rishta profile must be approved first.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    const imageUrls = await uploadMultipleImages(req.files);

    const updated = await prisma.rishtaProfile.update({
      where: { userId: req.user.id },
      data: {
        images: [...profile.images, ...imageUrls].slice(0, 5), // Max 5 photos
      },
    });

    res.json({ message: 'Photos uploaded!', images: updated.images });
  } catch (error) {
    console.error('Upload photos error:', error);
    res.status(500).json({ error: 'Failed to upload photos.' });
  }
});

/**
 * GET /api/rishta/profiles
 * Browse Rishta profiles (VERIFIED USERS ONLY)
 */
router.get('/profiles', authenticate, verifiedOnly, async (req, res) => {
  try {
    const { gender, minAge, maxAge, page = 1 } = req.query;
    const limit = 20;

    const where = {
      status: 'APPROVED',
      userId: { not: req.user.id }, // Don't show own profile
    };

    if (gender) where.gender = gender;
    if (minAge || maxAge) {
      where.age = {};
      if (minAge) where.age.gte = parseInt(minAge);
      if (maxAge) where.age.lte = parseInt(maxAge);
    }

    const [profiles, total] = await Promise.all([
      prisma.rishtaProfile.findMany({
        where,
        skip: (parseInt(page) - 1) * limit,
        take: limit,
        select: {
          id: true,
          age: true,
          gender: true,
          education: true,
          occupation: true,
          familyDetails: true,
          preferences: true,
          images: true,
          user: {
            select: { name: true, photoUrl: true },
          },
        },
      }),
      prisma.rishtaProfile.count({ where }),
    ]);

    res.json({
      profiles,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Rishta profiles error:', error);
    res.status(500).json({ error: 'Failed to load profiles.' });
  }
});

/**
 * POST /api/rishta/interest/:profileId
 * Send interest to a rishta profile
 */
router.post('/interest/:profileId', authenticate, verifiedOnly, async (req, res) => {
  try {
    const { profileId } = req.params;

    const profile = await prisma.rishtaProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.status !== 'APPROVED') {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    if (profile.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot send interest to yourself.' });
    }

    const existing = await prisma.rishtaInterest.findUnique({
      where: { fromUserId_profileId: { fromUserId: req.user.id, profileId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already sent interest to this profile.' });
    }

    await prisma.rishtaInterest.create({
      data: { fromUserId: req.user.id, profileId, status: 'PENDING' },
    });

    // Notify the profile owner
    try {
      await prisma.notification.create({
        data: {
          userId: profile.userId,
          title: '💝 New Rishta Interest',
          body: `${req.user.name} has sent you a rishta interest. Check your Interests tab!`,
        },
      });
    } catch (notifErr) {
      console.error('Notification error (interest sent):', notifErr);
    }

    res.json({ message: 'Interest sent successfully!' });
  } catch (error) {
    console.error('Send interest error:', error);
    res.status(500).json({ error: 'Failed to send interest.' });
  }
});

/**
 * GET /api/rishta/interests
 * Get interests received on my profile
 */
router.get('/interests', authenticate, verifiedOnly, async (req, res) => {
  try {
    const myProfile = await prisma.rishtaProfile.findUnique({ where: { userId: req.user.id } });
    if (!myProfile) return res.json({ interests: [] });

    const interests = await prisma.rishtaInterest.findMany({
      where: { profileId: myProfile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { id: true, name: true, phone: true, photoUrl: true } },
      },
    });

    res.json({ interests });
  } catch (error) {
    console.error('Get interests error:', error);
    res.status(500).json({ error: 'Failed to get interests.' });
  }
});

/**
 * GET /api/rishta/sent-interests
 * Get interests I have sent to other profiles
 */
router.get('/sent-interests', authenticate, verifiedOnly, async (req, res) => {
  try {
    const sentInterests = await prisma.rishtaInterest.findMany({
      where: { fromUserId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          select: {
            id: true, age: true, gender: true, education: true, occupation: true,
            user: { select: { id: true, name: true, phone: true, photoUrl: true } },
          },
        },
      },
    });

    res.json({ sentInterests });
  } catch (error) {
    console.error('Get sent interests error:', error);
    res.status(500).json({ error: 'Failed to get sent interests.' });
  }
});

/**
 * PUT /api/rishta/interest/:interestId/accept
 * Accept a received interest — auto-creates a private DM chat
 */
router.put('/interest/:interestId/accept', authenticate, verifiedOnly, async (req, res) => {
  try {
    const { interestId } = req.params;
    const myProfile = await prisma.rishtaProfile.findUnique({ where: { userId: req.user.id } });
    if (!myProfile) return res.status(404).json({ error: 'Profile not found.' });

    const interest = await prisma.rishtaInterest.findUnique({ where: { id: interestId } });
    if (!interest || interest.profileId !== myProfile.id) {
      return res.status(404).json({ error: 'Interest not found.' });
    }

    await prisma.rishtaInterest.update({ where: { id: interestId }, data: { status: 'ACCEPTED' } });

    // Auto-create a private DM chat between the two users (source: RISHTA)
    let chat = await prisma.dMChat.findFirst({
      where: {
        OR: [
          { user1Id: req.user.id, user2Id: interest.fromUserId },
          { user1Id: interest.fromUserId, user2Id: req.user.id },
        ],
      },
    });
    if (!chat) {
      chat = await prisma.dMChat.create({
        data: {
          user1Id: req.user.id,
          user2Id: interest.fromUserId,
          source: 'RISHTA',
        },
      });
    }

    // Notify the person whose interest was accepted
    try {
      await prisma.notification.create({
        data: {
          userId: interest.fromUserId,
          title: '✅ Rishta Interest Accepted!',
          body: `${req.user.name} accepted your rishta interest! A private chat has been created.`,
        },
      });
    } catch (notifErr) {
      console.error('Notification error (interest accepted):', notifErr);
    }

    res.json({
      message: 'Interest accepted! A private chat has been created.',
      chatId: chat.id,
    });
  } catch (error) {
    console.error('Accept interest error:', error);
    res.status(500).json({ error: 'Failed to accept interest.' });
  }
});

/**
 * PUT /api/rishta/interest/:interestId/reject
 * Reject a received interest
 */
router.put('/interest/:interestId/reject', authenticate, verifiedOnly, async (req, res) => {
  try {
    const { interestId } = req.params;
    const myProfile = await prisma.rishtaProfile.findUnique({ where: { userId: req.user.id } });
    if (!myProfile) return res.status(404).json({ error: 'Profile not found.' });

    const interest = await prisma.rishtaInterest.findUnique({ where: { id: interestId } });
    if (!interest || interest.profileId !== myProfile.id) {
      return res.status(404).json({ error: 'Interest not found.' });
    }

    await prisma.rishtaInterest.update({ where: { id: interestId }, data: { status: 'REJECTED' } });
    res.json({ message: 'Interest declined.' });
  } catch (error) {
    console.error('Reject interest error:', error);
    res.status(500).json({ error: 'Failed to reject interest.' });
  }
});

/**
 * POST /api/rishta/shortlist/:profileId
 * Add a profile to shortlist
 */
router.post('/shortlist/:profileId', authenticate, verifiedOnly, async (req, res) => {
  try {
    const { profileId } = req.params;

    const profile = await prisma.rishtaProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.status !== 'APPROVED') {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    if (profile.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot shortlist yourself.' });
    }

    const existing = await prisma.rishtaShortlist.findUnique({
      where: { userId_profileId: { userId: req.user.id, profileId } },
    });
    if (existing) {
      // Toggle off
      await prisma.rishtaShortlist.delete({ where: { id: existing.id } });
      return res.json({ message: 'Removed from shortlist.' });
    }

    await prisma.rishtaShortlist.create({ data: { userId: req.user.id, profileId } });
    res.json({ message: 'Added to shortlist!' });
  } catch (error) {
    console.error('Shortlist error:', error);
    res.status(500).json({ error: 'Failed to update shortlist.' });
  }
});

/**
 * GET /api/rishta/shortlisted
 * Get my shortlisted profiles
 */
router.get('/shortlisted', authenticate, verifiedOnly, async (req, res) => {
  try {
    const shortlisted = await prisma.rishtaShortlist.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          select: {
            id: true,
            age: true,
            gender: true,
            education: true,
            occupation: true,
            images: true,
            user: { select: { name: true, photoUrl: true } },
          },
        },
      },
    });

    res.json({ shortlisted });
  } catch (error) {
    console.error('Get shortlisted error:', error);
    res.status(500).json({ error: 'Failed to get shortlisted profiles.' });
  }
});

/**
 * DELETE /api/rishta/my-profile
 * Delete own Rishta profile (any status: PENDING, APPROVED, REJECTED)
 */
router.delete('/my-profile', authenticate, async (req, res) => {
  try {
    const profile = await prisma.rishtaProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: 'No Rishta profile found.' });
    }

    // Delete in correct order to respect foreign key constraints
    // 1. Delete interests involving this profile
    await prisma.rishtaInterest.deleteMany({ where: { profileId: profile.id } });
    // 2. Delete shortlists for this profile
    await prisma.rishtaShortlist.deleteMany({ where: { profileId: profile.id } });
    // 3. Delete the profile
    await prisma.rishtaProfile.delete({ where: { id: profile.id } });

    res.json({ message: 'Your Rishta profile has been deleted.' });
  } catch (error) {
    console.error('Delete rishta profile error:', error);
    res.status(500).json({ error: 'Failed to delete profile.' });
  }
});

module.exports = router;
