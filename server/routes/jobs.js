const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
// Removed express-validator to fix crash
const Job = require('../models/Job');
const User = require('../models/User');
const { authenticateToken, authorizeOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();

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
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/msword' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed'), false);
    }
  }
});

// Upload file to Cloudinary
const uploadToCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'global-connect/resumes',
        resource_type: 'raw'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
};

// @route   POST /api/jobs
// @desc    Post a new job
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Relaxed and aligned validation to avoid 400s and match required fields
    const { title, description, skills, location, company, jobType, experienceLevel, salary, applicationDeadline, isRemote = false, isUrgent = false } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description is required' });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ message: 'Location is required' });
    }
    // Normalize
    const normalizedSkills = Array.isArray(skills) ? skills : (skills ? String(skills).split(',').map(s => s.trim()).filter(Boolean) : []);

    // Create job
    const job = new Job({
      postedBy: req.user._id,
      title: title.trim(),
      company: company || 'Company',
      description: description.trim(),
      location: location.trim(),
      jobType: jobType || 'full-time',
      experienceLevel: experienceLevel || 'entry',
      salary: salary || { min: 0, max: 0 },
      applicationDeadline: applicationDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      requirements: [],
      responsibilities: [],
      skills: normalizedSkills,
      benefits: [],
      isRemote,
      isUrgent,
      tags: []
    });

    await job.save();

    // Populate postedBy info
    await job.populate('postedBy', 'name profilePic');

    res.status(201).json({
      message: 'Job posted successfully',
      job
    });
  } catch (error) {
    console.error('Post job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/jobs
// @desc    Get all jobs with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { 
      q, location, jobType, experienceLevel, isRemote, 
      minSalary, maxSalary, page = 1, limit = 10 
    } = req.query;
    const skip = (page - 1) * limit;

    const filters = {};
    
    // Text search (regex for stability without requiring text index)
    if (q && String(q).trim()) {
      const safe = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { company: { $regex: safe, $options: 'i' } },
        { skills: { $regex: safe, $options: 'i' } }
      ];
    }

    // Location filter
    if (location) {
      filters.location = { $regex: location, $options: 'i' };
    }

    // Job type filter
    if (jobType) {
      filters.jobType = jobType;
    }

    // Experience level filter
    if (experienceLevel) {
      filters.experienceLevel = experienceLevel;
    }

    // Remote filter
    if (isRemote !== undefined) {
      filters.isRemote = isRemote === 'true';
    }

    // Salary filter: match nested fields safely
    if (minSalary) {
      const min = parseInt(minSalary);
      if (!isNaN(min)) {
        filters['salary.min'] = { $gte: min };
      }
    }
    if (maxSalary) {
      const max = parseInt(maxSalary);
      if (!isNaN(max)) {
        filters['salary.max'] = { $lte: max };
      }
    }

    // Only active jobs that haven't expired
    filters.isActive = true;
    filters.applicationDeadline = { $gt: new Date() };

    const jobs = await Job.find(filters)
      .populate('postedBy', 'name profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments(filters);

    res.json(Array.isArray(jobs) ? jobs : []);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/jobs/:id
// @desc    Get a specific job
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('postedBy', 'name profilePic bio')
      .populate('applications.userId', 'name profilePic email');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (!job.isActive) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Increment views
    await job.incrementViews();

    res.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/jobs/apply/:jobId
// @desc    Apply for a job
// @access  Private
router.post('/apply/:jobId', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    console.log('Job application request:', {
      jobId: req.params.jobId,
      userId: req.user._id,
      body: req.body,
      file: req.file ? 'File provided' : 'No file'
    });

    // Manual validation
    const { coverLetter } = req.body;
    
    // Validate cover letter
    if (!coverLetter || !coverLetter.trim()) {
      console.log('Cover letter validation failed:', { coverLetter });
      return res.status(400).json({ message: 'Cover letter is required' });
    }
    
    if (coverLetter.length > 2000) {
      return res.status(400).json({ message: 'Cover letter cannot exceed 2000 characters' });
    }

    // Resume is optional - proceed without it if not provided
    if (!req.file) {
      console.log('No resume file provided, proceeding without resume');
    }

    const job = await Job.findById(req.params.jobId).populate('applications.userId');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (!job.isActive) {
      return res.status(400).json({ message: 'This job is no longer active' });
    }

    if (job.isExpired) {
      return res.status(400).json({ message: 'Application deadline has passed' });
    }

    // Check if user has already applied using the method
    try {
      const hasApplied = job.hasUserApplied(req.user._id);
      console.log('Has applied check:', { 
        hasApplied, 
        userId: req.user._id, 
        applications: job.applications?.length || 0,
        applicationUserIds: job.applications?.map(app => app.userId.toString()) || []
      });
      if (hasApplied) {
        return res.status(400).json({ message: 'You have already applied for this job' });
      }
    } catch (error) {
      console.error('Error checking if user has applied:', error);
      // Fallback check
      const existingApplication = job.applications?.find(app => 
        app.userId.toString() === req.user._id.toString()
      );
      if (existingApplication) {
        return res.status(400).json({ message: 'You have already applied for this job' });
      }
    }

    // Validate job data before saving
    console.log('Job data before saving:', {
      jobId: job._id,
      applicationsCount: job.applications?.length || 0,
      isActive: job.isActive,
      isExpired: job.isExpired
    });

    // Upload resume if provided
    let resumeUrl = '';
    if (req.file) {
      try {
        resumeUrl = await uploadToCloudinary(req.file);
      } catch (uploadError) {
        console.error('Resume upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload resume' });
      }
    }

    // Add application with proper data
    job.applications.push({
      userId: req.user._id,
      coverLetter: coverLetter || '',
      resume: resumeUrl,
      status: 'Pending',
      appliedAt: new Date()
    });

    // Save without triggering unrelated schema validations
    await job.save({ validateModifiedOnly: true });

    // Notify job poster
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipientId: job.postedBy,
        senderId: req.user._id,
        type: 'JOB_APPLICATION',
        title: 'New job application',
        message: `${req.user.name} applied for your job: ${job.title}`,
        data: { 
          jobId: job._id.toString(),
          applicantId: req.user._id.toString()
        }
      });

      const io = req.app.get('io');
      if (io) {
        io.to(job.postedBy.toString()).emit('notification:new', {
          recipientId: job.postedBy,
          senderId: req.user._id,
          type: 'JOB_APPLICATION',
          title: 'New job application',
          message: `${req.user.name} applied for your job: ${job.title}`
        });
      }
    } catch (notifyErr) {
      console.error('Failed to create job application notification:', notifyErr.message);
    }

    res.json({ message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Apply for job error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ 
        message: 'Invalid application data',
        details: Object.keys(error.errors).map(key => error.errors[key].message)
      });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid job ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/jobs/:id/apply
// @desc    Apply for a job
// @access  Private
router.post('/:id/apply', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    console.log('Job application request (alternative route):', {
      jobId: req.params.id,
      userId: req.user._id,
      body: req.body,
      file: req.file ? 'File provided' : 'No file'
    });

    const { coverLetter } = req.body;
    
    // Validate cover letter
    if (!coverLetter || !coverLetter.trim()) {
      console.log('Cover letter validation failed (alternative route):', { coverLetter });
      return res.status(400).json({ message: 'Cover letter is required' });
    }
    
    if (coverLetter.length > 2000) {
      return res.status(400).json({ message: 'Cover letter cannot exceed 2000 characters' });
    }

    // Resume is optional - proceed without it if not provided
    if (!req.file) {
      console.log('No resume file provided, proceeding without resume');
    }

    const job = await Job.findById(req.params.id).populate('applications.userId');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (!job.isActive) {
      return res.status(400).json({ message: 'This job is no longer active' });
    }

    // Check if user has already applied
    try {
      const hasApplied = job.hasUserApplied(req.user._id);
      console.log('Has applied check (alternative route):', { hasApplied, userId: req.user._id, applications: job.applications?.length || 0 });
      if (hasApplied) {
        return res.status(400).json({ message: 'You have already applied for this job' });
      }
    } catch (error) {
      console.error('Error checking if user has applied (alternative route):', error);
      // Fallback check
      const existingApplication = job.applications?.find(app => 
        app.userId.toString() === req.user._id.toString()
      );
      if (existingApplication) {
        return res.status(400).json({ message: 'You have already applied for this job' });
      }
    }

    // Upload resume to Cloudinary if provided
    let resumeUrl = '';
    if (req.file) {
      try {
        resumeUrl = await uploadToCloudinary(req.file);
      } catch (uploadError) {
        console.error('Resume upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload resume' });
      }
    }

    // Add application with proper data
    const application = {
      userId: req.user._id,
      coverLetter: coverLetter || '',
      resume: resumeUrl,
      status: 'Pending',
      appliedAt: new Date()
    };

    job.applications.push(application);

    // Save without triggering unrelated schema validations
    await job.save({ validateModifiedOnly: true });

    // Notify job poster
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        recipientId: job.postedBy,
        senderId: req.user._id,
        type: 'JOB_APPLICATION',
        title: 'New job application',
        message: `${req.user.name} applied for your job: ${job.title}`,
        data: { 
          jobId: job._id.toString(),
          applicantId: req.user._id.toString()
        }
      });

      const io = req.app.get('io');
      if (io) {
        io.to(job.postedBy.toString()).emit('notification:new', {
          recipientId: job.postedBy,
          senderId: req.user._id,
          type: 'JOB_APPLICATION',
          title: 'New job application',
          message: `${req.user.name} applied for your job: ${job.title}`
        });
      }
    } catch (notifyErr) {
      console.error('Failed to create job application notification:', notifyErr.message);
    }

    res.json({ message: 'Application submitted successfully' });
  } catch (error) {
    console.error('Apply for job error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid application data' });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid job ID' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/jobs/:id/applications
// @desc    Get job applications (Admin/Job Poster only)
// @access  Private
router.get('/:id/applications', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('applications.userId', 'name profilePic skills bio email')
      .populate('postedBy', 'name');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if user is admin or job poster
    if (job.postedBy._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ applications: job.applications });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/jobs/:id/applications/:applicationId/status
// @desc    Update application status (Admin/Job Poster only)
// @access  Private
router.put('/:id/applications/:applicationId/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if user is admin or job poster
    if (job.postedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
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
      if (status === 'Approved' && req.user.role === 'admin') {
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

// @route   POST /api/jobs/:id/save
// @desc    Save/unsave a job for user
// @access  Private
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize savedJobs array if it doesn't exist
    if (!user.savedJobs) {
      user.savedJobs = [];
    }

    const isSaved = user.savedJobs.includes(job._id);
    
    if (isSaved) {
      // Remove from saved jobs
      user.savedJobs = user.savedJobs.filter(id => id.toString() !== job._id.toString());
      await user.save();
      res.json({ message: 'Job removed from saved jobs', saved: false });
    } else {
      // Add to saved jobs
      user.savedJobs.push(job._id);
      await user.save();
      res.json({ message: 'Job saved successfully', saved: true });
    }
  } catch (error) {
    console.error('Save job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/jobs/saved
// @desc    Get user's saved jobs
// @access  Private
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('savedJobs');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const savedJobs = user.savedJobs || [];
    res.json({ savedJobs });
  } catch (error) {
    console.error('Get saved jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
