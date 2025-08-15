const express = require('express');
// Removed express-validator to fix crash
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipientId: req.user._id })
      .populate('senderId', 'name profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments({ recipientId: req.user._id });
    const unreadCount = await Notification.countDocuments({ 
      recipientId: req.user._id, 
      isRead: false 
    });

    res.json({
      notifications,
      unreadCount,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + notifications.length < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: req.params.id, 
        recipientId: req.user._id 
      },
      { isRead: true },
      { new: true }
    ).populate('senderId', 'name profilePic');

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipientId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/notifications
// @desc    Create notification (internal use)
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { recipientId, type, title, message, data } = req.body;
    
    // Validate recipientId
    if (!recipientId || typeof recipientId !== 'string') {
      return res.status(400).json({ message: 'Valid recipient ID required' });
    }

    // Validate notification type - allow all types
    const validTypes = [
      'CONNECTION_REQUEST', 
      'CONNECTION_ACCEPTED', 
      'MESSAGE', 
      'POST_FROM_CONNECTION',
      'JOB_APPLICATION',
      'JOB_APPLICATION_UPDATE',
      'POST_LIKE',
      'POST_COMMENT',
      'POST_SHARE'
    ];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Valid notification type required' });
    }
    
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const notification = new Notification({
      recipientId,
      senderId: req.user._id,
      type,
      title,
      message,
      data: data || {}
    });

    await notification.save();

    const populatedNotification = await notification.populate('senderId', 'name profilePic');

    res.status(201).json(populatedNotification);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
