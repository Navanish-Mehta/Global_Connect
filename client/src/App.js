import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useDispatch, useSelector } from 'react-redux';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { io } from 'socket.io-client';

// Redux actions
import { setSocket } from './redux/slices/socketSlice';
import { toast } from 'react-hot-toast';

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
      REACT_APP_GOOGLE_CLIENT_ID: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      NODE_ENV: process.env.NODE_ENV
    });
    console.log('Google Client ID (hardcoded): 1009256838290-iq2q3opv5bevvvok9t94a7vnhmhps4vd.apps.googleusercontent.com');
    console.log('Google OAuth Provider will be initialized with:', googleClientId);
  });

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

  // Google Client ID for OAuth - Use environment variable or fallback
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "1009256838290-iq2q3opv5bevvvok9t94a7vnhmhps4vd.apps.googleusercontent.com";

  // Error boundary for Google OAuth
  const [googleOAuthError, setGoogleOAuthError] = useState(false);

  // Handle Google OAuth errors
  useEffect(() => {
    const handleGoogleError = (error) => {
      console.error('Google OAuth error:', error);
      setGoogleOAuthError(true);
    };

    // Listen for Google OAuth errors
    window.addEventListener('error', handleGoogleError);
    return () => window.removeEventListener('error', handleGoogleError);
  }, []);

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
      
      {googleOAuthError ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Google OAuth Configuration Error</h1>
            <p className="text-gray-600 mb-4">There was an issue with Google authentication. Please refresh the page or contact support.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      ) : (
        <GoogleOAuthProvider clientId={googleClientId}>
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
      )}
    </>
  );
}

export default App;
