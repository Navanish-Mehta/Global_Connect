const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password is required only if not using Google OAuth
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  profilePic: {
    type: String,
    default: ''
  },
  bannerPic: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  website: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  experience: [{
    company: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true
    },
    location: String,
    from: {
      type: String,
      required: true
    },
    to: String,
    current: {
      type: Boolean,
      default: false
    },
    description: String
  }],
  education: [{
    school: {
      type: String,
      required: true
    },
    degree: {
      type: String,
      required: true
    },
    fieldOfStudy: String,
    from: {
      type: String,
      required: true
    },
    to: String,
    current: {
      type: Boolean,
      default: false
    },
    description: String
  }],
  skills: [{
    type: String,
    trim: true
  }],
  connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  connectionRequests: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Track requests the user has sent (to help guard against duplicates and power UI states)
  sentRequests: [{
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  }],
  savedJobs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  }],
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  googleId: String,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerificationToken: String,
  emailVerificationExpire: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for search functionality
userSchema.index({ name: 'text', bio: 'text', skills: 'text' });

// Hash password before saving
userSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get user profile without sensitive data
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpire;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpire;
  return userObject;
};

// Virtual for connection count
userSchema.virtual('connectionCount').get(function() {
  return this.connections ? this.connections.length : 0;
});

// Virtual for pending request count
userSchema.virtual('pendingRequestCount').get(function() {
  return this.connectionRequests ? this.connectionRequests.length : 0;
});

// Method to check if user is connected to another user
userSchema.methods.isConnectedTo = function(userId) {
  if (!this.connections || !Array.isArray(this.connections)) {
    return false;
  }
  return this.connections.some(id => id.toString() === userId.toString());
};

// Method to check if user has sent request to another user
userSchema.methods.hasSentRequestTo = function(userId) {
  if (!this.sentRequests || !Array.isArray(this.sentRequests)) {
    return false;
  }
  return this.sentRequests.some(req => req.to.toString() === userId.toString());
};

// Method to check if user has received request from another user
userSchema.methods.hasReceivedRequestFrom = function(userId) {
  if (!this.connectionRequests || !Array.isArray(this.connectionRequests)) {
    return false;
  }
  return this.connectionRequests.some(req => req.from.toString() === userId.toString());
};

// Method to get connection status with another user
userSchema.methods.getConnectionStatus = function(userId) {
  if (this.isConnectedTo(userId)) {
    return 'connected';
  } else if (this.hasSentRequestTo(userId)) {
    return 'requested';
  } else if (this.hasReceivedRequestFrom(userId)) {
    return 'pending';
  } else {
    return 'none';
  }
};

// Method to get all connections with populated data
userSchema.methods.getConnections = async function() {
  if (!this.connections || this.connections.length === 0) {
    return [];
  }
  
  const populatedConnections = await this.populate('connections', 'name profilePic bio location skills');
  return populatedConnections.connections;
};

// Method to get all connection requests with populated data
userSchema.methods.getConnectionRequests = async function() {
  if (!this.connectionRequests || this.connectionRequests.length === 0) {
    return [];
  }
  
  const populatedRequests = await this.populate('connectionRequests.from', 'name profilePic bio location skills');
  return populatedRequests.connectionRequests;
};

// Method to get all sent requests with populated data
userSchema.methods.getSentRequests = async function() {
  if (!this.sentRequests || this.sentRequests.length === 0) {
    return [];
  }
  
  const populatedSentRequests = await this.populate('sentRequests.to', 'name profilePic bio location skills');
  return populatedSentRequests.sentRequests;
};

module.exports = mongoose.model('User', userSchema);
