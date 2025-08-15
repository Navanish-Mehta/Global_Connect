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
  const dispatch = useDispatch();
  const { isAuthenticated, loading } = useSelector(state => state.auth);
  const { user } = useSelector(state => state.auth);

  useEffect(() => {
    // Check authentication status on app load
    dispatch(checkAuthStatus());
  }, [dispatch]);

  useEffect(() => {
    // Auto logout only on browser close, not on refresh
    const handleBeforeUnload = (event) => {
      // Only clear token on actual browser close, not refresh
      if (event.type === 'beforeunload') {
        // Don't clear token on refresh - let it persist
        // localStorage.removeItem('token');
        // sessionStorage.clear();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Optional: Clear sensitive data when tab becomes hidden
        // localStorage.removeItem('token');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize socket connection
      const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
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
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected to server after', attemptNumber, 'attempts');
      });

      socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
      });

      // Listen for real-time notifications
      socket.on('notification:new', (notification) => {
        try {
          dispatch(addNotification(notification));
          
          // Show toast notification
          const title = notification?.title || 'Notification';
          const message = notification?.message || '';
          toast.success(`${title}${message ? `: ${message}` : ''}`);
          
          // Refresh related data based on notification type
          if (notification.type === 'CONNECTION_REQUEST') {
            dispatch(getConnectionRequests());
          } else if (notification.type === 'CONNECTION_ACCEPTED') {
            dispatch(getConnections());
            dispatch(getConnectionRequests());
          }
        } catch (error) {
          console.error('Error handling notification:', error);
        }
      });

      // Listen for real-time messages
      socket.on('message:new', (message) => {
        try {
          dispatch(addMessage(message));
          
          // Update unread count for the conversation
          if (message.senderId !== user._id) {
            dispatch(updateUnreadCount({ 
              conversationId: message.senderId, 
              count: 1 
            }));
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      // Listen for connection updates
      socket.on('connection:accepted', (data) => {
        try {
          // Update connection status
          dispatch(updateConnectionStatus({ 
            userId: data.userId, 
            status: 'connected' 
          }));
          
          // Refresh connections and requests
          dispatch(getConnections());
          dispatch(getConnectionRequests());
          
          toast.success('Connection request accepted!');
        } catch (error) {
          console.error('Error handling connection accepted:', error);
        }
      });

      // Listen for connection updates
      socket.on('connection:update', (data) => {
        try {
          // Handle connection updates
          if (data.type === 'accepted') {
            dispatch(addConnection(data.user));
          } else if (data.type === 'removed') {
            dispatch(removeConnectionFromList(data.userId));
          }
        } catch (error) {
          console.error('Error handling connection update:', error);
        }
      });

      // Listen for generic notifications (fallback)
      socket.on('notification', (notification) => {
        try {
          const title = notification?.title || 'Notification';
          const message = notification?.message || '';
          toast.success(`${title}${message ? `: ${message}` : ''}`);
          
          // Refresh connection requests when related
          if (title.toLowerCase().includes('connection')) {
            dispatch(getConnectionRequests());
          }
        } catch (error) {
          console.error('Error handling generic notification:', error);
        }
      });

      dispatch(setSocket(socket));

      return () => {
        if (socket.connected) {
          socket.disconnect();
        }
      };
    }
  }, [isAuthenticated, user, dispatch]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
          <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "1009256838290-iq2q3opv5bevvvok9t94a7vnhmhps4vd.apps.googleusercontent.com"}>
      <Helmet>
        <title>Global Connect - Professional Networking Platform</title>
        <meta name="description" content="Connect with professionals, share updates, and find job opportunities on Global Connect." />
        <meta name="keywords" content="networking, professional, jobs, connections, career" />
        <meta property="og:title" content="Global Connect" />
        <meta property="og:description" content="Professional Networking Platform" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Global Connect" />
        <meta name="twitter:description" content="Professional Networking Platform" />
      </Helmet>

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Home />} />
        <Route path="/register" element={<Home />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Feed />} />
          <Route path="network" element={<Network />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="messages" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/:userId" element={<Profile />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />

        {/* 404 Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GoogleOAuthProvider>
  );
}

export default App;
