import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useGoogleLogin } from '@react-oauth/google';
import { register, loginWithGoogle } from '../../redux/slices/authSlice';
import { toast } from 'react-hot-toast';

const RegisterModal = ({ isOpen, onClose, onSwitchToLogin, onRegisterSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  
  const dispatch = useDispatch();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (isAdmin && adminToken !== 'Alino@865') {
      toast.error('Invalid admin token');
      return;
    }
    
    try {
      const registerData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: isAdmin ? 'admin' : 'user'
      };
      
      // Only add adminToken if registering as admin
      if (isAdmin) {
        registerData.adminToken = adminToken;
      }
      
      console.log('Sending registration data:', registerData);
      await dispatch(register(registerData)).unwrap();
      toast.success('Registration successful!');
      if (onRegisterSuccess) {
        onRegisterSuccess();
      } else {
        onClose();
      }
    } catch (error) {
      toast.error(error.message || 'Registration failed');
    }
  };

  // Google OAuth registration handler
  const googleRegister = useGoogleLogin({
    onSuccess: async (response) => {
      try {
        console.log('Google registration success:', response);
        await dispatch(loginWithGoogle(response)).unwrap();
        toast.success('Google registration successful!');
        if (onRegisterSuccess) {
          onRegisterSuccess();
        } else {
          onClose();
        }
      } catch (error) {
        console.error('Google registration error:', error);
        toast.error(error.message || 'Google registration failed');
      }
    },
    onError: (error) => {
      console.error('Google registration error:', error);
      if (error.type === 'missing_required_parameter') {
        toast.error('Google OAuth configuration error. Please contact support.');
        console.error('Google OAuth missing required parameter. This usually means the client_id is not properly configured.');
      } else {
        toast.error('Google registration failed. Please try again.');
      }
    },
    scope: 'openid email profile',
    flow: 'implicit'
  });

  // Debug Google OAuth configuration
  useEffect(() => {
    console.log('RegisterModal: Google OAuth configuration check');
    console.log('useGoogleLogin hook initialized');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Sign Up</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input w-full"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input w-full"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="input w-full pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="input w-full"
              placeholder="Confirm your password"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isAdmin"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700">
              Register as Admin
            </label>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Token</label>
              <input
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                required={isAdmin}
                className="input w-full"
                placeholder="Enter admin token"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
          >
            Create Account
          </button>
        </form>

        {/* Google OAuth button */}
        <div className="mt-4">
          <button
            onClick={() => googleRegister()}
            className="w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-primary-600 hover:text-primary-500 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;
