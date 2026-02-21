const express = require('express');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { uploadMedia } = require('../utils/upload');
const { uploadMultipleToCloudinary, uploadMultipleVideosToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

const MAX_VIDEO_DURATION = parseInt(process.env.MAX_VIDEO_DURATION_SECONDS || '180', 10); // seconds

/**
 * GET /api/posts
 * Get all posts (feed) with pagination
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, photoUrl: true },
          },
          _count: {
            select: { comments: true, likes: true },
          },
          likes: {
            where: { userId: req.user.id },
            select: { id: true },
          },
        },
      }),
      prisma.post.count(),
    ]);

    // Format response
    const formattedPosts = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined,
      _count: undefined,
    }));

    res.json({
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Failed to load feed.' });
  }
});

/**
 * GET /api/posts/videos
 * Get posts that have videos (video feed)
 */
router.get('/videos', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await prisma.post.findMany({
      where: {
        videos: { isEmpty: false },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true },
        },
        _count: {
          select: { comments: true, likes: true },
        },
        likes: {
          where: { userId: req.user.id },
          select: { id: true },
        },
      },
    });

    const videos = posts.map(post => ({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined,
      _count: undefined,
    }));

    res.json({ videos });
  } catch (error) {
    console.error('Video feed error:', error);
    res.status(500).json({ error: 'Failed to load video feed.' });
  }
});

/**
 * POST /api/posts
 * Create a new post (text + images + videos)
 */
router.post('/', authenticate, (req, res, next) => {
  uploadMedia.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 3 }
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Videos must be under ${process.env.MAX_VIDEO_SIZE_MB || 100}MB.` });
      }
      if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Too many files. Max 5 images + 3 videos.' });
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { text, videoDurations } = req.body;
    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];

    if (!text && imageFiles.length === 0 && videoFiles.length === 0) {
      return res.status(400).json({ error: 'Post must have text, images, or videos.' });
    }

    // Validate video durations if provided by client
    if (videoDurations) {
      try {
        const durations = JSON.parse(videoDurations);
        for (let i = 0; i < durations.length; i++) {
          if (durations[i] > MAX_VIDEO_DURATION) {
            return res.status(400).json({ error: `Video ${i + 1} is ${Math.round(durations[i])}s. Max is ${MAX_VIDEO_DURATION}s.` });
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    // Upload images to Cloudinary
    let imageUrls = [];
    if (imageFiles.length > 0) {
      imageUrls = await uploadMultipleToCloudinary(imageFiles, 'posts');
    }

    // Upload videos to Cloudinary
    let videoUrls = [];
    if (videoFiles.length > 0) {
      videoUrls = await uploadMultipleVideosToCloudinary(videoFiles, 'posts/videos');
    }

    const post = await prisma.post.create({
      data: {
        userId: req.user.id,
        text: text || null,
        images: imageUrls,
        videos: videoUrls,
      },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true },
        },
      },
    });

    res.status(201).json({
      message: 'Post created successfully!',
      post: {
        ...post,
        likesCount: 0,
        commentsCount: 0,
        isLiked: false,
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

/**
 * POST /api/posts/:id/like
 * Like or unlike a post
 */
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: {
          postId: id,
          userId: req.user.id,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({ where: { id: existingLike.id } });
      res.json({ message: 'Post unliked.', liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: {
          postId: id,
          userId: req.user.id,
        },
      });
      res.json({ message: 'Post liked!', liked: true });
    }
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like/unlike post.' });
  }
});

/**
 * GET /api/posts/:id/comments
 * Get comments for a post
 */
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const comments = await prisma.comment.findMany({
      where: { postId: id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true },
        },
      },
    });

    res.json({ comments });
  } catch (error) {
    console.error('Comments error:', error);
    res.status(500).json({ error: 'Failed to load comments.' });
  }
});

/**
 * POST /api/posts/:id/comments
 * Add a comment to a post
 */
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Comment text is required.' });
    }

    const comment = await prisma.comment.create({
      data: {
        postId: id,
        userId: req.user.id,
        text: text.trim(),
      },
      include: {
        user: {
          select: { id: true, name: true, photoUrl: true },
        },
      },
    });

    res.status(201).json({ message: 'Comment added.', comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete own post (or admin can delete any)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }

    await prisma.post.delete({ where: { id } });
    res.json({ message: 'Post deleted.' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

module.exports = router;
