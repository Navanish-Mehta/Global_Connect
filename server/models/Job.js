const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coverLetter: {
    type: String,
    maxlength: [2000, 'Cover letter cannot exceed 2000 characters']
  },
  resume: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

const jobSchema = new mongoose.Schema({
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [5000, 'Job description cannot exceed 5000 characters']
  },
  requirements: [{
    type: String,
    maxlength: [200, 'Requirement cannot exceed 200 characters']
  }],
  responsibilities: [{
    type: String,
    maxlength: [200, 'Responsibility cannot exceed 200 characters']
  }],
  skills: [{
    type: String,
    trim: true
  }],
  location: {
    type: String,
    required: [true, 'Job location is required']
  },
  jobType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance'],
    required: true
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'executive'],
    required: true
  },
  salary: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    period: {
      type: String,
      enum: ['hourly', 'monthly', 'yearly'],
      default: 'yearly'
    }
  },
  benefits: [{
    type: String,
    maxlength: [100, 'Benefit cannot exceed 100 characters']
  }],
  applications: [applicationSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isRemote: {
    type: Boolean,
    default: false
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  applicationDeadline: {
    type: Date,
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  savedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  reportCount: {
    type: Number,
    default: 0
  },
  reportedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for search and filtering
jobSchema.index({ title: 'text', description: 'text', skills: 'text', company: 'text' });
jobSchema.index({ location: 1, jobType: 1, experienceLevel: 1 });
jobSchema.index({ postedBy: 1, createdAt: -1 });
jobSchema.index({ isActive: 1, applicationDeadline: 1 });

// Virtual for application count
jobSchema.virtual('applicationCount').get(function() {
  return this.applications.length;
});

// Virtual for days until deadline
jobSchema.virtual('daysUntilDeadline').get(function() {
  const now = new Date();
  const deadline = new Date(this.applicationDeadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for is expired
jobSchema.virtual('isExpired').get(function() {
  return new Date() > new Date(this.applicationDeadline);
});

// Method to check if user has applied
jobSchema.methods.hasUserApplied = function(userId) {
  return this.applications.some(app => app.userId.toString() === userId.toString());
};

// Method to add application
jobSchema.methods.addApplication = function(userId, coverLetter, resume) {
  if (this.hasUserApplied(userId)) {
    throw new Error('User has already applied for this job');
  }
  
  if (this.isExpired) {
    throw new Error('Application deadline has passed');
  }
  
  this.applications.push({
    userId,
    coverLetter,
    resume
  });
  
  return this.save();
};

// Method to update application status
jobSchema.methods.updateApplicationStatus = function(applicationId, status, reviewedBy, notes) {
  const application = this.applications.id(applicationId);
  if (!application) {
    throw new Error('Application not found');
  }
  
  application.status = status;
  application.reviewedAt = new Date();
  application.reviewedBy = reviewedBy;
  if (notes) application.notes = notes;
  
  return this.save();
};

// Method to increment views
jobSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to toggle save
jobSchema.methods.toggleSave = function(userId) {
  const index = this.savedBy.indexOf(userId);
  if (index > -1) {
    this.savedBy.splice(index, 1);
  } else {
    this.savedBy.push(userId);
  }
  return this.save();
};

// Static method to search jobs
jobSchema.statics.searchJobs = function(query, filters = {}) {
  const searchQuery = {};
  
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  if (filters.location) {
    searchQuery.location = { $regex: filters.location, $options: 'i' };
  }
  
  if (filters.jobType) {
    searchQuery.jobType = filters.jobType;
  }
  
  if (filters.experienceLevel) {
    searchQuery.experienceLevel = filters.experienceLevel;
  }
  
  if (filters.isRemote !== undefined) {
    searchQuery.isRemote = filters.isRemote;
  }
  
  searchQuery.isActive = true;
  searchQuery.applicationDeadline = { $gt: new Date() };
  
  return this.find(searchQuery)
    .populate('postedBy', 'name profilePic company')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Job', jobSchema);
