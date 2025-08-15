const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config({ path: './config.env' });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const messageRoutes = require('./routes/messages');
const jobRoutes = require('./routes/jobs');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

const { authenticateSocket } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || "http://localhost:3000",
      "https://global-connect-umber.vercel.app",
      "https://global-connect-git-main-navanish-mehtas-projects.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Expose io instance to routes via app locals
app.set('io', io);

// CORS configuration - more permissive for development
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'https://global-connect-umber.vercel.app', // Add your Vercel domain
    'https://global-connect-git-main-navanish-mehtas-projects.vercel.app' // Add your Vercel domain with git branch
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Apply rate limiting after CORS
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in environment variables');
  console.log('Please set MONGODB_URI in your config.env file');
  process.exit(1);
}

// Simple in-memory database fallback for testing
const mockDB = {
  users: [],
  posts: [],
  jobs: [],
  messages: [],
  connections: []
};

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  global.useMockDB = false;
})
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  console.log('\nTo fix this issue:');
  console.log('1. Make sure MongoDB is running locally or MongoDB Atlas is accessible');
  console.log('2. Check your connection string in config.env file');
  console.log('3. Verify your MongoDB credentials');
  console.log('4. For local development, install MongoDB or use MongoDB Atlas');
  console.log('\nFor now, the server will continue without database connection...');
  console.log('Using in-memory database for testing...');
  
  // Set flag to use mock database
  global.useMockDB = true;
  global.mockDB = mockDB;
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  // Join user to their personal room
  socket.join(socket.userId);

  // Handle private messages
  socket.on('send_message', async (data) => {
    try {
      const { receiverId, content } = data;
      
      // Save message to database (implement in message controller)
      // const message = await saveMessage(socket.userId, receiverId, content);
      
      // Send to receiver if online
      socket.to(receiverId).emit('receive_message', {
        senderId: socket.userId,
        content,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    socket.to(data.receiverId).emit('user_typing', {
      userId: socket.userId,
      isTyping: data.isTyping
    });
  });

  // Handle online status
  socket.on('set_online_status', (status) => {
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status
    });
  });

  // Handle connection status updates
  socket.on('connection:update', (data) => {
    socket.broadcast.emit('connection:update', data);
  });

  // Handle connection acceptance
  socket.on('connection:accepted', (data) => {
    // Emit to both users involved in the connection
    if (data.userId) {
      socket.to(data.userId).emit('connection:accepted', {
        userId: socket.userId,
        message: 'Connection request accepted'
      });
    }
  });

  // Handle new notifications
  socket.on('notification:new', (data) => {
    if (data.recipientId) {
      socket.to(data.recipientId).emit('notification:new', data);
    }
  });

  // Handle new messages
  socket.on('message:new', (data) => {
    if (data.receiverId) {
      socket.to(data.receiverId).emit('message:new', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
    socket.broadcast.emit('user_status_change', {
      userId: socket.userId,
      status: 'offline'
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
