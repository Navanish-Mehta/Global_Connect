const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
// Removed express-validator to fix crash
const Post = require('../models/Post');
const User = require('../models/User');
const { authenticateToken, authorizeOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads (images and videos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Upload media to Cloudinary (auto resource type)
const uploadToCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'global-connect/posts',
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, resourceType: result.resource_type });
      }
    );

    stream.end(file.buffer);
  });
};

// @route   POST /api/upload
// @desc    Upload files to Cloudinary
// @access  Private
router.post('/upload', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Please upload at least one file' });
    }

    const uploadedUrls = [];
    const images = [];
    const videos = [];
    for (const file of req.files) {
      try {
        const uploaded = await uploadToCloudinary(file);
        uploadedUrls.push(uploaded.url);
        if (uploaded.resourceType === 'image') images.push(uploaded.url);
        if (uploaded.resourceType === 'video') videos.push(uploaded.url);
      } catch (error) {
        console.error('Upload error for file:', file.originalname, error);
        return res.status(500).json({ message: `Failed to upload ${file.originalname}` });
      }
    }

    res.json({ 
      message: 'Files uploaded successfully',
      urls: uploadedUrls,
      images,
      videos
    });
  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', authenticateToken, upload.fields([{ name: 'images', maxCount: 5 }, { name: 'videos', maxCount: 2 }]), async (req, res) => {
  try {
    // Manual validation and normalization
    const normalizeToArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      return [value];
    };

    const { content, visibility = 'public', tags } = req.body;

    const imageUrls = normalizeToArray(req.body.images);
    const videoUrls = normalizeToArray(req.body.videos);

    const hasUploadedFiles = !!(req.files && ((req.files.images && req.files.images.length > 0) || (req.files.videos && req.files.videos.length > 0)));
    const hasUrlMedia = imageUrls.length > 0 || videoUrls.length > 0;

    if (!content && !hasUploadedFiles && !hasUrlMedia) {
      return res.status(400).json({ message: 'Post must include text or at least one media (image/video)' });
    }

    if (!['public', 'connections', 'private'].includes(visibility)) {
      return res.status(400).json({ message: 'Invalid visibility setting' });
    }

    // Handle file uploads if any
    let finalImageUrls = [...imageUrls];
    let finalVideoUrls = [...videoUrls];
    
    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];
    
    for (const file of imageFiles) {
      try {
        const uploaded = await uploadToCloudinary(file);
        finalImageUrls.push(uploaded.url);
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(500).json({ message: `Failed to upload image: ${file.originalname}` });
      }
    }
    
    for (const file of videoFiles) {
      try {
        const uploaded = await uploadToCloudinary(file);
        finalVideoUrls.push(uploaded.url);
      } catch (error) {
        console.error('Video upload error:', error);
        return res.status(500).json({ message: `Failed to upload video: ${file.originalname}` });
      }
    }

    // Create post
    const post = new Post({
      userId: req.user._id,
      content,
      images: finalImageUrls,
      videos: finalVideoUrls,
      visibility,
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : [])
    });

    await post.save();

    // Populate user info
    await post.populate('userId', 'name profilePic');

  // Notify all connections of the author about the new post
  try {
    const author = await User.findById(req.user._id).select('connections name');
    if (author && Array.isArray(author.connections) && author.connections.length > 0) {
      const Notification = require('../models/Notification');
      const notifications = await Notification.insertMany(
        author.connections.map(connId => ({
          recipientId: connId,
          senderId: req.user._id,
          type: 'POST_FROM_CONNECTION',
          title: 'New post from connection',
          message: `${author.name || 'A connection'} shared a new post`,
          data: { postId: post._id.toString() }
        }))
      );
      const io = req.app.get('io');
      if (io) {
        author.connections.forEach(connId => {
          io.to(connId.toString()).emit('notification:new', notifications.find(n => n.recipientId.toString() === connId.toString()) || {
            recipientId: connId,
            senderId: req.user._id,
            type: 'POST_FROM_CONNECTION',
            title: 'New post from connection',
            message: `${author.name || 'A connection'} shared a new post`,
            data: { postId: post._id.toString() }
          });
        });
      }
    }
  } catch (notifyErr) {
    console.error('Failed to send post notifications:', notifyErr.message);
  }

    res.status(201).json({ message: 'Post created successfully', post });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/feed/:userId
// @desc    Get user's feed (posts from connections and self)
// @access  Private
router.get('/feed/:userId', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's connections and include user's own posts
    const connectionIds = [...user.connections, user._id];

    let query = {
      userId: { $in: connectionIds },
      isDeleted: false
    };

    // Filter by visibility
    query.$or = [
      { visibility: 'public' },
      { userId: user._id }, // User's own posts
      { 
        userId: { $in: user.connections },
        visibility: 'connections'
      }
    ];

    const posts = await Post.find(query)
      .populate('userId', 'name profilePic')
      .populate('comments.userId', 'name profilePic')
      .populate('likes', 'name profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);
    
    console.log('Feed response:', { 
      postsCount: posts.length, 
      total, 
      userId: req.params.userId,
      query: query
    });

    res.json({
      posts: Array.isArray(posts) ? posts : [],
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + posts.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id
// @desc    Get a specific post
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('userId', 'name profilePic bio')
      .populate('comments.userId', 'name profilePic')
      .populate('likes', 'name profilePic')
      .populate('shares.userId', 'name profilePic');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ post });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update a post
// @access  Private
router.put('/:id', authenticateToken, authorizeOwnerOrAdmin(), async (req, res) => {
  try {
    const { content, visibility, tags } = req.body;
    if (visibility && !['public', 'connections', 'private'].includes(visibility)) {
      return res.status(400).json({ message: 'Invalid visibility setting' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Update fields
    if (content) post.content = content;
    if (visibility) post.visibility = visibility;
    if (tags) post.tags = Array.isArray(tags) ? tags : [tags];

    await post.save();

    // Populate user info
    await post.populate('userId', 'name profilePic');

    res.json({
      message: 'Post updated successfully',
      post
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user owns the post or is admin
    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Soft delete
    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/posts/:id/like
// @desc    Toggle like on a post
// @access  Private
router.put('/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const wasLiked = post.isLikedBy(req.user._id);
    await post.toggleLike(req.user._id);
    const isNowLiked = post.isLikedBy(req.user._id);

    // Create notification only when liking (not unliking) and not on own post
    if (isNowLiked && !wasLiked && post.userId.toString() !== req.user._id.toString()) {
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          recipientId: post.userId,
          senderId: req.user._id,
          type: 'POST_LIKE',
          title: 'Post liked',
          message: `${req.user.name} liked your post`,
          data: { 
            postId: post._id.toString(),
            senderId: req.user._id.toString()
          }
        });

        // Emit real-time notification
        const io = req.app.get('io');
        if (io) {
          io.to(post.userId.toString()).emit('notification:new', {
            recipientId: post.userId,
            senderId: req.user._id,
            type: 'POST_LIKE',
            title: 'Post liked',
            message: `${req.user.name} liked your post`
          });
        }
      } catch (notifyErr) {
        console.error('Failed to create like notification:', notifyErr.message);
      }
    }

    res.json({
      message: 'Post like toggled successfully',
      isLiked: isNowLiked,
      likeCount: post.likes.length
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comment
// @desc    Add a comment to a post
// @access  Private
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 1000) {
      return res.status(400).json({ message: 'Comment must be between 1 and 1000 characters' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    await post.addComment(req.user._id, text);

    // Populate the new comment
    await post.populate('comments.userId', 'name profilePic');

    const newComment = post.comments[post.comments.length - 1];

    // Create notification for comment (only if not commenting on own post)
    if (post.userId.toString() !== req.user._id.toString()) {
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          recipientId: post.userId,
          senderId: req.user._id,
          type: 'POST_COMMENT',
          title: 'Post commented',
          message: `${req.user.name} commented on your post`,
          data: { 
            postId: post._id.toString(),
            senderId: req.user._id.toString(),
            commentId: newComment._id.toString()
          }
        });

        // Emit real-time notification
        const io = req.app.get('io');
        if (io) {
          io.to(post.userId.toString()).emit('notification:new', {
            recipientId: post.userId,
            senderId: req.user._id,
            type: 'POST_COMMENT',
            title: 'Post commented',
            message: `${req.user.name} commented on your post`
          });
        }
      } catch (notifyErr) {
        console.error('Failed to create comment notification:', notifyErr.message);
      }
    }

    res.json({
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:postId/comment/:commentId
// @desc    Delete a comment
// @access  Private
router.delete('/:postId/comment/:commentId', authenticateToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment or is admin
    if (comment.userId.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin' && 
        req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await post.removeComment(commentId);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/share
// @desc    Share a post
// @access  Private
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const originalPost = await Post.findById(req.params.id)
      .populate('userId', 'name profilePic');
    
    if (!originalPost) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (originalPost.isDeleted) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Create shared post
    const sharedPost = new Post({
      userId: req.user._id,
      content: `Shared from ${originalPost.userId.name}`,
      sharedFrom: originalPost._id,
      originalContent: originalPost.content,
      originalImages: originalPost.images,
      originalVideos: originalPost.videos,
      visibility: 'public',
      isShared: true
    });

    await sharedPost.save();
    await sharedPost.populate('userId', 'name profilePic');

    // Add to original post's shares
    await originalPost.sharePost(req.user._id);

    // Notify original post owner
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipientId: originalPost.userId._id,
        senderId: req.user._id,
        type: 'POST_SHARED',
        title: 'Your post was shared',
        message: `${req.user.name} shared your post`,
        data: { 
          postId: originalPost._id.toString(),
          sharedPostId: sharedPost._id.toString()
        }
      });

      const io = req.app.get('io');
      if (io) {
        io.to(originalPost.userId._id.toString()).emit('notification:new', {
          recipientId: originalPost.userId._id,
          senderId: req.user._id,
          type: 'POST_SHARED',
          title: 'Your post was shared',
          message: `${req.user.name} shared your post`
        });
      }
    } catch (notifyErr) {
      console.error('Failed to create share notification:', notifyErr.message);
    }

    res.status(201).json({ 
      message: 'Post shared successfully', 
      sharedPost 
    });
  } catch (error) {
    console.error('Share post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/search
// @desc    Search posts
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, tags, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isDeleted: false, visibility: 'public' };

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Tags filter
    if (tags) {
      const tagsArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagsArray };
    }

    const posts = await Post.find(query)
      .populate('userId', 'name profilePic')
      .populate('comments.userId', 'name profilePic')
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + posts.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Search posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
