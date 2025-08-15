const express = require('express');
// Removed express-validator to fix crash
const User = require('../models/User');
const Post = require('../models/Post');
const Job = require('../models/Job');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(authorizeAdmin);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const activeUsers = await User.countDocuments({ isActive: true, role: { $ne: 'admin' } });
    const totalPosts = await Post.countDocuments({ isDeleted: false });
    const totalJobs = await Job.countDocuments({ isActive: true });
    const reportedPosts = await Post.countDocuments({ reportCount: { $gt: 0 } });
    const reportedJobs = await Job.countDocuments({ reportCount: { $gt: 0 } });

    // Recent activity
    const recentUsers = await User.find({ role: { $ne: 'admin' } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email createdAt');

    const recentPosts = await Post.find({ isDeleted: false })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('content createdAt reportCount');

    const recentJobs = await Job.find({ isActive: true })
      .populate('postedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title company createdAt reportCount');

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalPosts,
        totalJobs,
        reportedPosts,
        reportedJobs
      },
      recentActivity: {
        users: recentUsers,
        posts: recentPosts,
        jobs: recentJobs
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin panel
// @access  Private (Admin only)
router.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const users = await User.find(query)
      .select('name email profilePic bio location skills role createdAt isActive')
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
    console.error('Get admin users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin)
// @access  Private (Admin)
router.put('/users/:id', async (req, res) => {
  try {
    // Manual validation
    const { role, isActive, isVerified } = req.body;
    
    if (role && !['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Active status must be a boolean' });
    }
    
    if (isVerified !== undefined && typeof isVerified !== 'boolean') {
      return res.status(400).json({ message: 'Verification status must be a boolean' });
    }


    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (isVerified !== undefined) user.isVerified = isVerified;

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/ban
// @desc    Ban/unban user (admin)
// @access  Private (Admin)
router.put('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle ban status
    user.isActive = !user.isActive;
    await user.save();

    res.json({ 
      message: user.isActive ? 'User unbanned successfully' : 'User banned successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin)
// @access  Private (Admin)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Soft delete
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/posts
// @desc    Get all posts for admin panel
// @access  Private (Admin only)
router.get('/posts', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find({ isDeleted: false })
      .populate('userId', 'name profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Post.countDocuments({ isDeleted: false });
    
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
    console.error('Get admin posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/posts/:id
// @desc    Delete post (admin)
// @access  Private (Admin)
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
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

// @route   GET /api/admin/jobs
// @desc    Get all jobs for admin panel
// @access  Private (Admin only)
router.get('/jobs', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const jobs = await Job.find({ isActive: true })
      .populate('postedBy', 'name profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Job.countDocuments({ isActive: true });
    
    res.json({
      jobs: Array.isArray(jobs) ? jobs : [],
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: skip + (jobs ? jobs.length : 0) < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get admin jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/jobs/:id
// @desc    Delete job (admin)
// @access  Private (Admin)
router.delete('/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Soft delete
    job.isActive = false;
    await job.save();

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/reports
// @desc    Get reported content
// @access  Private (Admin)
router.get('/reports', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let reportedContent = [];

    if (!type || type === 'posts') {
      const reportedPosts = await Post.find({ reportCount: { $gt: 0 } })
        .populate('userId', 'name email')
        .populate('reportedBy.userId', 'name')
        .sort({ reportCount: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      reportedContent.push(...reportedPosts.map(post => ({
        type: 'post',
        content: post
      })));
    }

    if (!type || type === 'jobs') {
      const reportedJobs = await Job.find({ reportCount: { $gt: 0 } })
        .populate('postedBy', 'name email')
        .populate('reportedBy.userId', 'name')
        .sort({ reportCount: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      reportedContent.push(...reportedJobs.map(job => ({
        type: 'job',
        content: job
      })));
    }

    // Sort by report count
    reportedContent.sort((a, b) => b.content.reportCount - a.content.reportCount);

    res.json({
      reports: reportedContent,
      pagination: {
        current: parseInt(page),
        hasNext: reportedContent.length === parseInt(limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/job-applications
// @desc    Get all job applications for admin review
// @access  Private (Admin)
router.get('/job-applications', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    // Get all jobs with applications
    const jobs = await Job.find({ 
      'applications.0': { $exists: true } 
    })
    .populate('postedBy', 'name')
    .populate('applications.userId', 'name profilePic skills bio email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Filter applications by status if specified
    let allApplications = [];
    jobs.forEach(job => {
      job.applications.forEach(app => {
        if (!status || app.status === status) {
          allApplications.push({
            _id: app._id,
            jobId: job._id,
            jobTitle: job.title,
            company: job.company,
            applicant: app.userId,
            coverLetter: app.coverLetter,
            resume: app.resume,
            status: app.status,
            appliedAt: app.appliedAt,
            postedBy: job.postedBy
          });
        }
      });
    });

    // Sort by application date
    allApplications.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

    res.json({
      applications: allApplications,
      pagination: {
        current: parseInt(page),
        hasNext: allApplications.length === parseInt(limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/job-applications/:applicationId/status
// @desc    Update job application status (Admin only)
// @access  Private (Admin)
router.put('/job-applications/:applicationId/status', async (req, res) => {
  try {
    const { status, jobId } = req.body;
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const application = job.applications.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    application.updatedAt = new Date();

    await job.save();

    // Notify applicant
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipientId: application.userId,
        senderId: req.user._id,
        type: 'JOB_APPLICATION_UPDATE',
        title: `Job application ${status.toLowerCase()}`,
        message: `Your application for ${job.title} has been ${status.toLowerCase()}`,
        data: { 
          jobId: job._id.toString(),
          status: status
        }
      });

      const io = req.app.get('io');
      if (io) {
        io.to(application.userId.toString()).emit('notification:new', {
          recipientId: application.userId,
          senderId: req.user._id,
          type: 'JOB_APPLICATION_UPDATE',
          title: `Job application ${status.toLowerCase()}`,
          message: `Your application for ${job.title} has been ${status.toLowerCase()}`
        });
      }

      // If approved, send a message to the applicant
      if (status === 'Approved') {
        try {
          const Message = require('../models/Message');
          const message = new Message({
            senderId: req.user._id,
            receiverId: application.userId,
            content: `Congratulations! Your application for ${job.title} has been approved. We will contact you soon with next steps.`,
            messageType: 'text'
          });
          await message.save();

          // Emit message via socket
          if (io) {
            io.to(application.userId.toString()).emit('message:new', {
              _id: message._id,
              senderId: req.user._id,
              receiverId: application.userId,
              content: message.content,
              messageType: 'text',
              createdAt: message.createdAt,
              sender: {
                _id: req.user._id,
                name: req.user.name,
                profilePic: req.user.profilePic
              }
            });
          }
        } catch (messageErr) {
          console.error('Failed to send approval message:', messageErr.message);
        }
      }
    } catch (notifyErr) {
      console.error('Failed to create job application update notification:', notifyErr.message);
    }

    res.json({ message: 'Application status updated successfully' });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/job-applications/:applicationId/resume
// @desc    Download resume for job application
// @access  Private (Admin)
router.get('/job-applications/:applicationId/resume', async (req, res) => {
  try {
    // Find the job that contains this application
    const job = await Job.findOne({ 'applications._id': req.params.applicationId });
    if (!job) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const application = job.applications.id(req.params.applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (!application.resume) {
      return res.status(404).json({ message: 'No resume found for this application' });
    }

    // Redirect to the Cloudinary URL
    res.redirect(application.resume);
  } catch (error) {
    console.error('Download resume error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
