const express = require('express');
const mongoose = require('mongoose');
// Removed express-validator to fix crash
const Message = require('../models/Message');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/messages
// @desc    Send a message (body contains receiverId)
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content, messageType = 'text', mediaUrl, replyTo } = req.body;
    if (!receiverId || typeof receiverId !== 'string') {
      return res.status(400).json({ message: 'Valid receiver ID is required' });
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > 2000) {
      return res.status(400).json({ message: 'Message content must be between 1 and 2000 characters' });
    }
    if (!['text', 'image', 'file', 'link'].includes(messageType)) {
      return res.status(400).json({ message: 'Invalid message type' });
    }
    if (messageType !== 'text' && mediaUrl && !/^https?:\/\//i.test(mediaUrl)) {
      return res.status(400).json({ message: 'Valid media URL is required for non-text messages' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Check permissions: regular users can only message connections, admins can message anyone
    const isConnected = req.user.connections && req.user.connections.some(id => id.toString() === receiverId);
    const isAdmin = req.user.role === 'admin';

    if (!isConnected && !isAdmin) {
      return res.status(403).json({ message: 'You can only message your connections' });
    }

    // Create message
    const message = new Message({
      senderId: req.user._id,
      receiverId,
      content,
      messageType,
      mediaUrl,
      replyTo
    });

    await message.save();

    // Populate sender and receiver info
    await message.populate('senderId', 'name profilePic');
    await message.populate('receiverId', 'name profilePic');
    if (replyTo) {
      await message.populate('replyTo', 'content senderId');
    }

    // Emit realtime events
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          _id: message._id,
          senderId: req.user._id,
          receiverId,
          content,
          messageType,
          mediaUrl,
          createdAt: message.createdAt,
          sender: {
            _id: req.user._id,
            name: req.user.name,
            profilePic: req.user.profilePic
          }
        };
        io.to(receiverId.toString()).emit('message:new', payload);
        // Backward-compat with existing frontend listener
        io.to(receiverId.toString()).emit('receive_message', payload);
      }
    } catch (error) {
      console.error('Socket emit error:', error);
    }

    // Create notification for new message
    try {
      const Notification = require('../models/Notification');
      const notification = await Notification.create({
        recipientId: receiverId,
        senderId: req.user._id,
        type: 'MESSAGE',
        title: 'New message',
        message: content?.slice(0, 80) || 'New message',
        data: { senderId: req.user._id.toString() }
      });
      
      const io = req.app.get('io');
      if (io) {
        io.to(receiverId.toString()).emit('notification:new', notification);
      }
    } catch (error) {
      console.error('Notification creation error:', error);
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages/:userId
// @desc    Send a message to userId (route param)
// @access  Private
router.post('/:userId', authenticateToken, async (req, res) => {
  try {
    req.body.receiverId = req.params.userId;
    return router.handle({ ...req, url: '/api/messages' }, res);
  } catch (error) {
    console.error('Send message by param error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/thread/:sender/:receiver
// @desc    Get conversation between two users (legacy)
// @access  Private
router.get('/thread/:sender/:receiver', authenticateToken, async (req, res) => {
  try {
    const { sender, receiver } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Verify user is part of the conversation
    if (req.user._id.toString() !== sender && req.user._id.toString() !== receiver) {
      return res.status(403).json({ message: 'Not authorized to view this conversation' });
    }

    const messages = await Message.getConversation(sender, receiver, parseInt(limit), skip);

    // Mark messages as read if current user is the receiver
    if (req.user._id.toString() === receiver) {
      await Message.markConversationAsRead(sender, receiver);
    }

    res.json({
      messages: messages.reverse(), // Show oldest first
      pagination: {
        current: parseInt(page),
        hasNext: messages.length === parseInt(limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/conversation/:userId
// @desc    Get conversation between current user and another user
// @access  Private
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Check permissions: regular users can only view conversations with connections, admins can view any conversation
    const isConnected = req.user.connections && req.user.connections.some(id => id.toString() === userId);
    const isAdmin = req.user.role === 'admin';

    if (!isConnected && !isAdmin) {
      return res.status(403).json({ message: 'You can only view conversations with your connections' });
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ],
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('senderId', 'name profilePic')
    .populate('receiverId', 'name profilePic')
    .lean();

    const total = await Message.countDocuments({
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ],
      isDeleted: false
    });

    // Mark messages as read
    await Message.updateMany(
      {
        senderId: userId,
        receiverId: req.user._id,
        isRead: false,
        isDeleted: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + messages.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/messages/conversation/:userId/read
// @desc    Mark all messages in a conversation as read
// @access  Private
router.put('/conversation/:userId/read', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if users are connected OR if current user is admin
    const isConnected = req.user.connections && req.user.connections.some(id => id.toString() === userId);
    if (!isConnected && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only mark conversations with your connections as read' });
    }

    // Mark all unread messages from this user as read
    const result = await Message.updateMany(
      {
        senderId: userId,
        receiverId: req.user._id,
        isRead: false,
        isDeleted: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({ 
      message: 'Conversation marked as read',
      conversationId: userId,
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark conversation as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-safe conversations list MUST be defined before parameterized routes
// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user (admin gets all users list)
// @access  Private
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Admin: return all users (except self) for sidebar, do not touch connections logic
    if (req.user.role === 'admin') {
      const users = await User.find({ _id: { $ne: currentUserId }, isActive: true })
        .select('_id name profilePic bio location role')
        .sort({ name: 1 })
        .lean();
      return res.json({ mode: 'admin', users: Array.isArray(users) ? users : [], conversations: [] });
    }

    // Non-admin: maintain connections-only behavior
    const user = await User.findById(currentUserId).select('connections');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized - User not found' });
    }

    const connectionIds = (user.connections || []).map(id => id.toString());
    if (connectionIds.length === 0) {
      return res.json({ mode: 'user', users: [], conversations: [] });
    }

    const matchCondition = {
      isDeleted: false,
      $or: [
        { senderId: currentUserId, receiverId: { $in: connectionIds } },
        { receiverId: currentUserId, senderId: { $in: connectionIds } }
      ]
    };

    const conversations = await Message.aggregate([
      { $match: matchCondition },
      { $addFields: { otherUser: { $cond: { if: { $eq: ['$senderId', currentUserId] }, then: '$receiverId', else: '$senderId' } } } },
      { $group: { _id: '$otherUser', lastMessage: { $first: '$$ROOT' }, unreadCount: { $sum: { $cond: [ { $and: [ { $eq: ['$receiverId', currentUserId] }, { $eq: ['$isRead', false] } ] }, 1, 0 ] } } } },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const otherUser = await User.findById(conv._id).select('name profilePic');
        if (!otherUser) return null;
        return { _id: conv._id, user: otherUser, lastMessage: conv.lastMessage, unreadCount: conv.unreadCount };
      })
    );

    const validConversations = populatedConversations.filter(Boolean);
    return res.json({ mode: 'user', users: [], conversations: validConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/:otherUserId
// @desc    Get conversation between current user and other user
// @access  Private
router.get('/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const otherId = req.params.otherUserId;

    // Ensure they are connected OR if current user is admin
    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isConnected = me.connections && me.connections.map(id => id.toString()).includes(otherId.toString());
    if (!isConnected && me.role !== 'admin') {
      return res.status(403).json({ message: 'You can only view messages with your connections' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId }
      ],
      isDeleted: false
    }).sort({ createdAt: 1 });

    return res.json({ messages });
  } catch (error) {
    console.error('Get conversation (pair) error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    console.log('Get conversations request:', {
      userId: currentUserId,
      userRole: req.user.role
    });
    
    // Verify user exists and get their connections
    const user = await User.findById(currentUserId).select('connections role');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized - User not found' });
    }

    console.log('User data:', {
      userId: user._id,
      role: user.role,
      connections: user.connections,
      connectionsCount: user.connections?.length || 0
    });

    // For admin users, return empty conversations (sidebar is populated via /users/admin)
    if (user.role === 'admin') {
      return res.json({ conversations: [] });
    }

    // For regular users, show only conversations with connections
    let matchCondition = {
      $or: [
        { senderId: currentUserId },
        { receiverId: currentUserId }
      ],
      isDeleted: false
    };

    if (user.role !== 'admin') {
      const connectionIds = user.connections.map(id => id.toString()) || [];
      if (connectionIds.length === 0) {
        // If user has no connections, return empty conversations instead of 403
        console.log('User has no connections - returning empty conversations');
        return res.json({ conversations: [] });
      }
      matchCondition = {
        isDeleted: false,
        $or: [
          { senderId: currentUserId, receiverId: { $in: connectionIds } },
          { receiverId: currentUserId, senderId: { $in: connectionIds } }
        ]
      };
    }

    // Get last message from each conversation
    const conversations = await Message.aggregate([
      {
        $match: matchCondition
      },
      {
        $addFields: {
          otherUser: {
            $cond: {
              if: { $eq: ['$senderId', currentUserId] },
              then: '$receiverId',
              else: '$senderId'
            }
          }
        }
      },
      {
        $group: {
          _id: '$otherUser',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', currentUserId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Populate user details and get conversation previews
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        try {
          const otherUser = await User.findById(conv._id).select('name profilePic');
          if (!otherUser) return null; // Skip if user was deleted
          return {
            _id: conv._id,
            user: otherUser,
            lastMessage: conv.lastMessage,
            unreadCount: conv.unreadCount
          };
        } catch (err) {
          console.error('Error populating user:', err);
          return null;
        }
      })
    );

    // Filter out null values and return conversations
    const validConversations = populatedConversations.filter(conv => conv !== null);

    res.json({ conversations: validConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the receiver
    if (message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to mark this message as read' });
    }

    await message.markAsRead();

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/messages/:id/reaction
// @desc    Add/update reaction to message
// @access  Private
router.put('/:id/reaction', authenticateToken, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string' || emoji.length < 1 || emoji.length > 10) {
      return res.status(400).json({ message: 'Emoji must be between 1 and 10 characters' });
    }

    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    await message.addReaction(req.user._id, emoji);

    res.json({ message: 'Reaction added successfully' });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/:id/reaction
// @desc    Remove reaction from message
// @access  Private
router.delete('/:id/reaction', authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    await message.removeReaction(req.user._id);

    res.json({ message: 'Reaction removed successfully' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete a message (soft delete)
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender or receiver
    if (message.senderId.toString() !== req.user._id.toString() && 
        message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy.push({
      userId: req.user._id,
      deletedAt: new Date()
    });

    await message.save();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get unread message count for current user
// @access  Private
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const unreadCount = await Message.getUnreadCount(req.user._id);

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
