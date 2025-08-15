import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/axios';

// Async thunks
export const updateProfile = createAsyncThunk(
  'user/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await api.put(`/users/${profileData.userId}`, profileData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Profile update failed');
    }
  }
);

export const uploadProfilePicture = createAsyncThunk(
  'user/uploadProfilePicture',
  async ({ userId, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post(`/users/${userId}/profile-picture`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Profile picture upload failed');
    }
  }
);

export const uploadBannerPicture = createAsyncThunk(
  'user/uploadBannerPicture',
  async ({ userId, file }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post(`/users/${userId}/banner-picture`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Banner picture upload failed');
    }
  }
);

export const sendConnectionRequest = createAsyncThunk(
  'user/sendConnectionRequest',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/users/connect/${userId}`, {});
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Connection request failed');
    }
  }
);

export const acceptConnectionRequest = createAsyncThunk(
  'user/acceptConnectionRequest',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/users/connect/${userId}`, { action: 'accept' });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Connection acceptance failed');
    }
  }
);

export const rejectConnectionRequest = createAsyncThunk(
  'user/rejectConnectionRequest',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/users/connect/${userId}`, { action: 'reject' });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Connection rejection failed');
    }
  }
);

export const removeConnection = createAsyncThunk(
  'user/removeConnection',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/users/connect/${userId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Connection removal failed');
    }
  }
);

export const getNetworkUsers = createAsyncThunk(
  'user/getNetworkUsers',
  async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/network?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get network users');
    }
  }
);

export const getConnections = createAsyncThunk(
  'user/getConnections',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      // If user is admin, get all users; otherwise get connections
      if (auth.user?.role === 'admin') {
        const response = await api.get('/users/admin');
        return { connections: response.data.users };
      } else {
        const response = await api.get('/users/connections');
        return response.data;
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get connections');
    }
  }
);

export const getConnectionRequests = createAsyncThunk(
  'user/getConnectionRequests',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/connection-requests');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get connection requests');
    }
  }
);

export const getUserConnectionsForMessaging = createAsyncThunk(
  'user/getUserConnectionsForMessaging',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/users/connections-for-messaging');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get connections for messaging');
    }
  }
);

export const searchUsers = createAsyncThunk(
  'user/searchUsers',
  async ({ query, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Search failed');
    }
  }
);

export const searchUsersWithStatus = createAsyncThunk(
  'user/searchUsersWithStatus',
  async ({ query, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/search-with-status?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Search with status failed');
    }
  }
);

export const getUserConnections = createAsyncThunk(
  'user/getUserConnections',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      if (!auth.user?._id) {
        return rejectWithValue('User not authenticated');
      }
      
      const response = await api.get(`/users/${auth.user._id}/connections`);
      return response.data.connections;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch connections');
    }
  }
);

export const getConnectionStatus = createAsyncThunk(
  'user/getConnectionStatus',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/${userId}/connection-status`);
      return { userId, status: response.data.status };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get connection status');
    }
  }
);

// Admin functionality
export const getUsers = createAsyncThunk(
  'user/getUsers',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const isAdmin = auth.user?.role === 'admin';
      
      // Use different endpoints for admin vs regular users
      const endpoint = isAdmin ? '/admin/users' : '/users';
      const response = await api.get(endpoint);
      
      return response.data.users || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'user/deleteUser',
  async (userId, { rejectWithValue }) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      return userId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete user');
    }
  }
);

export const banUser = createAsyncThunk(
  'user/banUser',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/admin/users/${userId}/ban`, {});
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to ban user');
    }
  }
);

export const unbanUser = createAsyncThunk(
  'user/unbanUser',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/users/${userId}/unban`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unban user');
    }
  }
);

const initialState = {
  profile: null,
  connections: [],
  searchResults: [],
  networkUsers: [],
  loading: false,
  error: null,
  connectionRequests: [],
  pendingConnections: [],
  users: [], // Add users array for admin functionality
  connectionStatuses: {}, // Track connection status for each user
  pagination: {
    current: 1,
    total: 1,
    hasNext: false,
    hasPrev: false
  }
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    clearNetworkUsers: (state) => {
      state.networkUsers = [];
    },
    setProfile: (state, action) => {
      state.profile = action.payload;
    },
    updateConnectionStatus: (state, action) => {
      const { userId, status } = action.payload;
      state.connectionStatuses[userId] = status;
    },
    addConnection: (state, action) => {
      const newConnection = action.payload;
      if (!state.connections.find(conn => conn._id === newConnection._id)) {
        state.connections.push(newConnection);
      }
    },
    removeConnectionFromList: (state, action) => {
      const userId = action.payload;
      state.connections = state.connections.filter(conn => conn._id !== userId);
    }
  },
  extraReducers: (builder) => {
    builder
      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Upload profile picture
      .addCase(uploadProfilePicture.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadProfilePicture.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profile) {
          state.profile.profilePic = action.payload.profilePic;
        }
      })
      .addCase(uploadProfilePicture.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Upload banner picture
      .addCase(uploadBannerPicture.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadBannerPicture.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profile) {
          state.profile.bannerPic = action.payload.bannerPic;
        }
      })
      .addCase(uploadBannerPicture.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Search users with status
      .addCase(searchUsersWithStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchUsersWithStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload.users || [];
        state.pagination = action.payload.pagination || {};
      })
      .addCase(searchUsersWithStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get network users
      .addCase(getNetworkUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getNetworkUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.networkUsers = action.payload.users || [];
        state.pagination = action.payload.pagination || {};
      })
      .addCase(getNetworkUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get connections
      .addCase(getConnections.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConnections.fulfilled, (state, action) => {
        state.loading = false;
        state.connections = action.payload.connections || [];
      })
      .addCase(getConnections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get connection requests
      .addCase(getConnectionRequests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConnectionRequests.fulfilled, (state, action) => {
        state.loading = false;
        state.connectionRequests = action.payload.connectionRequests || [];
      })
      .addCase(getConnectionRequests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get connections for messaging
      .addCase(getUserConnectionsForMessaging.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserConnectionsForMessaging.fulfilled, (state, action) => {
        state.loading = false;
        // This is for messaging, so we don't overwrite the main connections
        // We could store it separately if needed
      })
      .addCase(getUserConnectionsForMessaging.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Connection actions
      .addCase(sendConnectionRequest.fulfilled, (state, action) => {
        // Handle connection request sent - update status
        state.error = null;
      })
      .addCase(acceptConnectionRequest.fulfilled, (state, action) => {
        // Handle connection accepted - update status and add to connections
        state.error = null;
      })
      .addCase(rejectConnectionRequest.fulfilled, (state, action) => {
        // Handle connection rejected - update status
        state.error = null;
      })
      .addCase(removeConnection.fulfilled, (state, action) => {
        // Handle connection removed - update status
        state.error = null;
      })
      // Search users
      .addCase(searchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload.users || [];
        state.pagination = action.payload.pagination || {};
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get user connections
      .addCase(getUserConnections.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserConnections.fulfilled, (state, action) => {
        state.loading = false;
        state.connections = action.payload;
      })
      .addCase(getUserConnections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get connection status
      .addCase(getConnectionStatus.fulfilled, (state, action) => {
        const { userId, status } = action.payload;
        state.connectionStatuses[userId] = status;
      })
      // Admin functionality
      .addCase(getUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        const userId = action.payload;
        state.users = state.users.filter(user => user._id !== userId);
      })
      .addCase(banUser.fulfilled, (state, action) => {
        const updatedUser = action.payload;
        const index = state.users.findIndex(user => user._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
      })
      .addCase(unbanUser.fulfilled, (state, action) => {
        const updatedUser = action.payload;
        const index = state.users.findIndex(user => user._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
      });
  }
});

export const { clearError, clearSearchResults, clearNetworkUsers, setProfile, updateConnectionStatus, addConnection, removeConnectionFromList } = userSlice.actions;
export default userSlice.reducer;
