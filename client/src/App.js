import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useDispatch, useSelector } from 'react-redux';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { io } from 'socket.io-client';

// Redux actions
import { setSocket } from './redux/slices/socketSlice';
import { toast } from 'react-hot-toast';
import { 
  getConnectionRequests, 
  getConnections, 
  updateConnectionStatus,
  addConnection,
  removeConnectionFromList
} from './redux/slices/userSlice';
import { addMessage, updateUnreadCount } from './redux/slices/messageSlice';
import { addNotification } from './redux/slices/notificationSlice';
import { checkAuthStatus } from './redux/slices/authSlice';

// Components
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingSpinner from './components/UI/LoadingSpinner';

// Pages
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import Messages from './pages/Messages';
import Network from './pages/Network';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Feed from './pages/Feed';

function App() {
  console.log('App function called');
  
  const dispatch = useDispatch();
  const { isAuthenticated, loading } = useSelector(state => state.auth);
  const { user } = useSelector(state => state.auth);

  console.log('App state:', { isAuthenticated, loading, user });

  // Add error boundary for debugging
  useEffect(() => {
    console.log('App component mounted');
    console.log('Environment variables:', {
      REACT_APP_API_URL: process.env.REACT_APP_API_URL,
      REACT_APP_SOCKET_URL: process.env.REACT_APP_SOCKET_URL,
      NODE_ENV: process.env.NODE_ENV
    });
  }, []);

  useEffect(() => {
    console.log('checkAuthStatus effect triggered');
    // Check authentication status on app load
    dispatch(checkAuthStatus());
  }, [dispatch]);

  // Add better error handling for socket connection
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('Attempting to connect to socket...');
      
      // Get socket URL with fallback logic
      const getSocketUrl = () => {
        // Check if we're in production (Vercel)
        if (window.location.hostname.includes('vercel.app')) {
          return 'https://global-connect-6yfc.onrender.com';
        }
        
        // Check environment variable
        if (process.env.REACT_APP_SOCKET_URL) {
          return process.env.REACT_APP_SOCKET_URL;
        }
        
        // Fallback to localhost
        return 'http://localhost:5000';
      };
      
      const socketUrl = getSocketUrl();
      console.log('Socket URL:', socketUrl);
      
      // Initialize socket connection
      const socket = io(socketUrl, {
        auth: {
          token: localStorage.getItem('token')
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      socket.on('connect', () => {
        console.log('Connected to server');
        dispatch(setSocket(socket));
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        toast.error('Failed to connect to server. Some features may not work.');
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
      });

      socket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
      });

      socket.on('reconnect_failed', () => {
        console.error('Socket reconnection failed');
        toast.error('Failed to reconnect to server');
      });

      // Store socket in Redux
      dispatch(setSocket(socket));

      return () => {
        socket.disconnect();
      };
    }
  }, [isAuthenticated, user, dispatch]);

  // Add loading state for debugging
  if (loading) {
    console.log('App is loading...');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  console.log('App render - isAuthenticated:', isAuthenticated, 'user:', user);

  return (
    <>
      <Helmet>
        <title>Global Connect - Professional Networking</title>
        <meta name="description" content="Connect with professionals worldwide" />
      </Helmet>
      
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
        <Routes>
          {/* Public Routes - Always accessible */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Home />} />
          <Route path="/register" element={<Home />} />
          
          {/* Protected Routes - Require authentication */}
          <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Feed />} />
            <Route path="feed" element={<Feed />} />
            <Route path="network" element={<Network />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="messages" element={<Messages />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:userId" element={<Profile />} />
          </Route>
          
          {/* Admin Routes - Require admin role */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          <Route path="/admin/*" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          
          {/* Legacy Routes - Redirect to dashboard */}
          <Route path="/feed" element={<Navigate to="/dashboard/feed" replace />} />
          <Route path="/jobs" element={<Navigate to="/dashboard/jobs" replace />} />
          <Route path="/messages" element={<Navigate to="/dashboard/messages" replace />} />
          <Route path="/network" element={<Navigate to="/dashboard/network" replace />} />
          <Route path="/profile" element={<Navigate to="/dashboard/profile" replace />} />
          
          {/* 404 Route - Redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GoogleOAuthProvider>
    </>
  );
}

export default App;
