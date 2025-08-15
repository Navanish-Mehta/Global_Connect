const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
// Removed express-validator to fix crash
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { authenticateToken, authorizeOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Place all special routes BEFORE parameterized routes to prevent conflicts
// @route   GET /api/users/admin
// @desc    Get all users for admin panel (including admins) - placed early to avoid being shadowed by /:id
// @access  Private (Admin only)
router.get('/admin', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true, _id: { $ne: req.user._id } };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { bio: searchRegex },
        { location: searchRegex }
      ];
    }

    const users = await User.find(query)
      .select('name email profilePic bio location skills role createdAt isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    return res.json({
      users: Array.isArray(users) ? users : [],
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + (users ? users.length : 0) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// @route   GET /api/users/network
// @desc    Get all users with connection status for Network page
// @access  Private
router.get('/network', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    const query = { 
      isActive: true, 
      role: { $ne: 'admin' }, 
      _id: { $ne: currentUserId } 
    };

    const users = await User.find(query)
      .select('_id name profilePic skills bio location')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    // Get current user's connection status for each user
    const currentUser = await User.findById(currentUserId).select('connections connectionRequests sentRequests');
    
    const usersWithStatus = users.map(user => {
      const status = currentUser.getConnectionStatus(user._id);
      return {
        ...user,
        connectionStatus: status
      };
    });

    const total = await User.countDocuments(query);

    res.json({
      users: usersWithStatus,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + users.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get network users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/connections
// @desc    Get current user's connections
// @access  Private
router.get('/connections', authenticateToken, async (req, res) => {
  try {
    // For admin users, return all users; for regular users, return connections
    if (req.user.role === 'admin') {
      const allUsers = await User.find({ isActive: true })
        .select('name profilePic bio location skills role')
        .sort({ name: 1 });
      
      res.json({
        connections: allUsers
      });
    } else {
      const user = await User.findById(req.user._id)
        .populate('connections', 'name profilePic bio location skills')
        .select('connections');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        connections: user.connections || []
      });
    }
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// @route   GET /api/users/connection-requests
// @desc    Get current user's connection requests
// @access  Private
router.get('/connection-requests', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connectionRequests.from', 'name profilePic bio location skills')
      .select('connectionRequests');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      connectionRequests: user.connectionRequests || []
    });
  } catch (error) {
    console.error('Get connection requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/connections-for-messaging
// @desc    Get current user's connections for messaging
// @access  Private
router.get('/connections-for-messaging', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connections', 'name profilePic bio location skills')
      .select('connections');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      connections: user.connections || []
    });
  } catch (error) {
    console.error('Get connections for messaging error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/search-with-status
// @desc    Search users with connection status for current user
// @access  Private
router.get('/search-with-status', authenticateToken, async (req, res) => {
  try {
    const { q, location, skills, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    let query = { isActive: true, role: { $ne: 'admin' }, _id: { $ne: currentUserId } };

    // Handle empty or invalid search query gracefully - return all users
    if (!q || typeof q !== 'string' || !q.trim()) {
      const allUsers = await User.find(query)
        .select('_id name profilePic skills bio location')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean();

      // Get current user's connection status for each result
      const currentUser = await User.findById(currentUserId).select('connections connectionRequests sentRequests');
      
      const usersWithStatus = allUsers.map(user => {
        const status = currentUser.getConnectionStatus(user._id);
        return {
          ...user,
          connectionStatus: status
        };
      });

      const total = await User.countDocuments(query);

      return res.json({
        users: usersWithStatus,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: skip + allUsers.length < total,
          hasPrev: page > 1
        }
      });
    }

    const escapeRegex = (s) => String(s || '')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, ' ');

    const safe = escapeRegex(q.trim());
    query.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { skills: { $regex: safe, $options: 'i' } }
    ];

    if (location && location.trim()) {
      const safeLoc = escapeRegex(location.trim());
      query.location = { $regex: safeLoc, $options: 'i' };
    }

    if (skills && skills.trim()) {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) {
        query.skills = { $in: skillsArray };
      }
    }

    const users = await User.find(query)
      .select('_id name profilePic skills bio location')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    // Get current user's connection status for each search result
    const currentUser = await User.findById(currentUserId).select('connections connectionRequests sentRequests');
    
    const usersWithStatus = users.map(user => {
      const status = currentUser.getConnectionStatus(user._id);
      return {
        ...user,
        connectionStatus: status
      };
    });

    const total = await User.countDocuments(query);

    res.json({
      users: usersWithStatus,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + users.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Search users with status error:', error);
    // Return empty results instead of error to prevent 500
    res.json({ 
      users: [], 
      pagination: { 
        current: 1, 
        total: 1, 
        hasNext: false, 
        hasPrev: false 
      } 
    });
  }
});

// Place search route early to avoid being shadowed by parameterized routes
// @route   GET /api/users/search
// @desc    Search users by name/skills
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, location, skills, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true, role: { $ne: 'admin' } };

    // Handle empty or invalid search query gracefully - return all users
    if (!q || typeof q !== 'string' || !q.trim()) {
      const allUsers = await User.find(query)
        .select('_id name profilePic skills bio location')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .lean();

      const total = await User.countDocuments(query);

      return res.json({
        users: Array.isArray(allUsers) ? allUsers : [],
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: skip + (allUsers ? allUsers.length : 0) < total,
          hasPrev: page > 1
        }
      });
    }

    const escapeRegex = (s) => String(s || '')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, ' ');

    const safe = escapeRegex(q.trim());
    query.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { skills: { $regex: safe, $options: 'i' } }
    ];

    if (location && location.trim()) {
      const safeLoc = escapeRegex(location.trim());
      query.location = { $regex: safeLoc, $options: 'i' };
    }

    if (skills && skills.trim()) {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) {
        query.skills = { $in: skillsArray };
      }
    }

    const users = await User.find(query)
      .select('_id name profilePic skills bio location')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      users: Array.isArray(users) ? users : [],
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + (users ? users.length : 0) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    // Return empty results instead of error to prevent 500
    res.json({ 
      users: [], 
      pagination: { 
        current: 1, 
        total: 1, 
        hasNext: false, 
        hasPrev: false 
      } 
    });
  }
});

// @route   GET /api/users/me/connections
// @desc    Get current user's connections for messaging
// @access  Private
router.get('/me/connections', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connections', 'name profilePic bio location skills')
      .select('connections');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      connections: Array.isArray(user.connections) ? user.connections : []
    });
  } catch (error) {
    console.error('Get user connections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload image to Cloudinary
const uploadToCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'global-connect',
        transformation: [
          { width: 500, height: 500, crop: 'fill' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
};

// @route   GET /api/users/:id
// @desc    Get user profile
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire')
      .populate('connections', 'name profilePic bio location')
      .populate('connectionRequests.from', 'name profilePic');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's posts count
    const postsCount = await Post.countDocuments({ 
      userId: user._id, 
      isDeleted: false 
    });

    const userData = user.toObject();
    userData.postsCount = postsCount;

    res.json({ user: userData });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private
router.put('/:id', authenticateToken, authorizeOwnerOrAdmin(), async (req, res) => {
  try {
    const { name, bio, location, website, phone, skills, experience, education } = req.body;
    if (name && (name.trim().length < 2 || name.trim().length > 50)) {
      return res.status(400).json({ message: 'Name must be between 2 and 50 characters' });
    }
    if (bio && bio.length > 500) {
      return res.status(400).json({ message: 'Bio cannot exceed 500 characters' });
    }
    if (website && !/^https?:\/\//i.test(website)) {
      return res.status(400).json({ message: 'Please enter a valid website URL' });
    }
    if (skills && !Array.isArray(skills)) {
      return res.status(400).json({ message: 'Skills must be an array' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (phone !== undefined) user.phone = phone;
    if (skills) user.skills = skills;
    if (experience) user.experience = experience;
    if (education) user.education = education;

    await user.save();

    res.json({ 
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/profile-picture
// @desc    Upload profile picture
// @access  Private
router.post('/:id/profile-picture', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user owns the profile or is admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Upload to Cloudinary
    const imageUrl = await uploadToCloudinary(req.file);

    // Update user profile picture
    user.profilePic = imageUrl;
    await user.save();

    res.json({ 
      message: 'Profile picture updated successfully',
      profilePic: imageUrl
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

// @route   POST /api/users/:id/banner-picture
// @desc    Upload banner picture
// @access  Private
router.post('/:id/banner-picture', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user owns the profile or is admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Upload to Cloudinary
    const imageUrl = await uploadToCloudinary(req.file);

    // Update user banner picture
    user.bannerPic = imageUrl;
    await user.save();

    res.json({ 
      message: 'Banner picture updated successfully',
      bannerPic: imageUrl
    });
  } catch (error) {
    console.error('Upload banner picture error:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

// @route   POST /api/users/connect/:id
// @desc    Send connection request
// @access  Private
router.post('/connect/:id', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    console.log('Connection request:', { targetUserId, currentUserId: currentUserId.toString() });

    // Validate target user ID
    if (!targetUserId || !require('mongoose').Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (currentUserId.toString() === targetUserId) {
      return res.status(400).json({ message: 'Cannot connect with yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!targetUser.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure arrays exist and are properly initialized
    if (!Array.isArray(req.user.connections)) req.user.connections = [];
    if (!Array.isArray(req.user.connectionRequests)) req.user.connectionRequests = [];
    if (!Array.isArray(req.user.sentRequests)) req.user.sentRequests = [];
    if (!Array.isArray(targetUser.connections)) targetUser.connections = [];
    if (!Array.isArray(targetUser.connectionRequests)) targetUser.connectionRequests = [];

    // Check if already connected
    if (req.user.isConnectedTo(targetUserId)) {
      return res.json({ message: 'Already connected' });
    }

    // Check if request already sent (either recorded on target or sender)
    if (req.user.hasSentRequestTo(targetUserId) || targetUser.hasReceivedRequestFrom(currentUserId)) {
      return res.json({ message: 'Connection request already pending' });
    }

    // Check if target user has sent a request to current user
    if (req.user.hasReceivedRequestFrom(targetUserId)) {
      return res.json({ message: 'User has already sent you a connection request' });
    }

    // Add to target user's connection requests
    targetUser.connectionRequests.push({ from: currentUserId, sentAt: new Date() });
    // Track on sender side
    req.user.sentRequests.push({ to: targetUserId, sentAt: new Date() });
    
    await targetUser.save();
    await req.user.save();

    // Create notification for target user
    try {
      const notification = await Notification.create({
        recipientId: targetUserId,
        senderId: currentUserId,
        type: 'CONNECTION_REQUEST',
        title: 'New connection request',
        message: `${req.user.name || 'Someone'} sent you a connection request`,
        data: { from: currentUserId.toString() }
      });
      
      // Emit real-time notification if receiver is online
      const io = req.app.get('io');
      if (io) {
        io.to(targetUserId.toString()).emit('notification:new', notification);
      }
    } catch (e) {
      console.error('Failed to create/emit connection request notification:', e.message);
    }

    res.json({ message: 'Connection request sent successfully' });
  } catch (error) {
    console.error('Send connection request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/connect/:id
// @desc    Accept/reject connection request
// @access  Private
router.put('/connect/:id', authenticateToken, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const requestUserId = req.params.id;
    const currentUserId = req.user._id;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    // Find the connection request
    const requestIndex = req.user.connectionRequests.findIndex(
      r => r.from.toString() === requestUserId
    );

    if (requestIndex === -1) {
      // Gracefully handle if already connected or no pending request
      if (req.user.isConnectedTo(requestUserId)) {
        return res.json({ message: 'Already connected' });
      }
      return res.json({ message: 'No pending connection request from this user' });
    }

    // Remove the request on receiver
    const [removed] = req.user.connectionRequests.splice(requestIndex, 1);

    if (action === 'accept') {
      // Add to connections for both users
      if (!req.user.isConnectedTo(requestUserId)) {
        req.user.connections.push(requestUserId);
      }
      
      const requestUser = await User.findById(requestUserId);
      if (requestUser) {
        if (!Array.isArray(requestUser.connections)) requestUser.connections = [];
        if (!Array.isArray(requestUser.sentRequests)) requestUser.sentRequests = [];
        if (!requestUser.isConnectedTo(currentUserId)) {
          requestUser.connections.push(currentUserId);
        }
        // Remove any sentRequest from sender tracking this receiver
        requestUser.sentRequests = requestUser.sentRequests.filter(r => r.to.toString() !== currentUserId.toString());
        await requestUser.save();
      }

      // Notify sender that request was accepted
      try {
        const notification = await Notification.create({
          recipientId: requestUserId,
          senderId: currentUserId,
          type: 'CONNECTION_ACCEPTED',
          title: 'Connection request accepted',
          message: `${req.user.name || 'Your connection'} accepted your request`,
          data: { acceptedBy: currentUserId.toString() }
        });
        
        const io = req.app.get('io');
        if (io) {
          io.to(requestUserId.toString()).emit('notification:new', notification);
          // Emit connection update to both users
          io.to(requestUserId.toString()).emit('connection:accepted', { 
            userId: currentUserId.toString(),
            message: 'Connection request accepted'
          });
          io.to(currentUserId.toString()).emit('connection:accepted', { 
            userId: requestUserId.toString(),
            message: 'Connection request accepted'
          });
        }
      } catch (e) {
        console.error('Failed to create connection accepted notification:', e.message);
      }
    }

    await req.user.save();

    res.json({ 
      message: `Connection request ${action}ed successfully` 
    });
  } catch (error) {
    console.error('Handle connection request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/connect/:id
// @desc    Remove connection
// @access  Private
router.delete('/connect/:id', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    // Remove from current user's connections
    req.user.connections = req.user.connections.filter(
      id => id.toString() !== targetUserId
    );

    // Remove from target user's connections
    const targetUser = await User.findById(targetUserId);
    if (targetUser) {
      targetUser.connections = targetUser.connections.filter(
        id => id.toString() !== currentUserId.toString()
      );
      await targetUser.save();
    }

    await req.user.save();

    res.json({ message: 'Connection removed successfully' });
  } catch (error) {
    console.error('Remove connection error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/connections
// @desc    Get user connections
// @access  Public
router.get('/:id/connections', async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ message: 'Valid user ID is required' });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId)
      .populate({
        path: 'connections',
        select: 'name profilePic bio location skills',
        options: {
          skip: parseInt(skip),
          limit: parseInt(limit)
        }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const total = user.connections.length;

    res.json({
      connections: Array.isArray(user.connections) ? user.connections : [],
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + (user.connections ? user.connections.length : 0) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/posts
// @desc    Get user posts
// @access  Public
router.get('/:id/posts', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      userId: req.params.id, 
      isDeleted: false 
    })
    .populate('userId', 'name profilePic')
    .populate('comments.userId', 'name profilePic')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Post.countDocuments({ 
      userId: req.params.id, 
      isDeleted: false 
    });

    res.json({
      posts: Array.isArray(posts) ? posts : [],
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + (posts ? posts.length : 0) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/connection-requests
// @desc    Get user connection requests
// @access  Private
router.get('/:id/connection-requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!userId || userId === 'undefined') {
      return res.status(400).json({ message: 'Valid user ID is required' });
    }

    // Only allow users to see their own connection requests
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.user._id)
      .populate({
        path: 'connectionRequests.from',
        select: 'name profilePic bio location skills'
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(Array.isArray(user.connectionRequests) ? user.connectionRequests : []);
  } catch (error) {
    console.error('Get connection requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id/ban
// @desc    Ban a user
// @access  Private (Admin only)
router.put('/:id/ban', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = false;
    await user.save();

    res.json({ message: 'User banned successfully', user });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id/unban
// @desc    Unban a user
// @access  Private (Admin only)
router.put('/:id/unban', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = true;
    await user.save();

    res.json({ message: 'User unbanned successfully', user });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/connection-status
// @desc    Get connection status between current user and target user
// @access  Private
router.get('/:id/connection-status', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === targetUserId) {
      return res.json({ status: 'self' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check connection status
    let status = 'none';
    if (req.user.isConnectedTo(targetUserId)) {
      status = 'connected';
    } else if (req.user.hasSentRequestTo(targetUserId)) {
      status = 'requested';
    } else if (req.user.hasReceivedRequestFrom(targetUserId)) {
      status = 'incoming';
    }

    res.json({ status });
  } catch (error) {
    console.error('Get connection status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users
// @desc    Get all non-admin users (for admin panel and network page)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { role: { $ne: 'admin' }, isActive: true };
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const users = await User.find(query)
      .select('name profilePic bio location skills createdAt isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users: Array.isArray(users) ? users : [],
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + (users ? users.length : 0) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// (moved earlier) GET /api/users/admin is defined near the top to avoid being shadowed by /:id

module.exports = router;
