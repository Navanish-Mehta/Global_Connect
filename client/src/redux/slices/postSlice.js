import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/axios';

// Async thunks
export const createPost = createAsyncThunk(
  'post/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      // Two-step flow: if images/videos are URLs, send JSON.
      // If they are File objects, send multipart.
      const hasFileObjects = (arr) => Array.isArray(arr) && arr.some(f => typeof f === 'object' && f instanceof File);

      const sendMultipart = hasFileObjects(postData.images) || hasFileObjects(postData.videos);

      let response;
      if (sendMultipart) {
        const formData = new FormData();
        if (postData.content) formData.append('content', postData.content);
        formData.append('visibility', postData.visibility || 'public');
        if (Array.isArray(postData.images)) {
          postData.images.forEach((imageFile) => {
            formData.append('images', imageFile);
          });
        }
        if (Array.isArray(postData.videos)) {
          postData.videos.forEach((videoFile) => {
            formData.append('videos', videoFile);
          });
        }
        response = await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const jsonPayload = {
          content: postData.content,
          visibility: postData.visibility || 'public',
          images: Array.isArray(postData.images) ? postData.images : [],
          videos: Array.isArray(postData.videos) ? postData.videos : []
        };
        response = await api.post('/posts', jsonPayload);
      }
      // Return the created post object directly
      return response.data.post;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Post creation failed');
    }
  }
);

export const getFeed = createAsyncThunk(
  'post/getFeed',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/posts/feed/${userId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feed');
    }
  }
);

export const getUserPosts = createAsyncThunk(
  'post/getUserPosts',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/${userId}/posts`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch user posts');
    }
  }
);

export const likePost = createAsyncThunk(
  'post/likePost',
  async (postId, { rejectWithValue, getState }) => {
    try {
      const response = await api.put(`/posts/${postId}/like`);
      const currentUserId = getState().auth.user?._id;
      return { postId, currentUserId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to like post');
    }
  }
);

export const addComment = createAsyncThunk(
  'post/addComment',
  async ({ postId, text }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/posts/${postId}/comment`, { text });
      return { postId, comment: response.data.comment };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add comment');
    }
  }
);

export const deleteComment = createAsyncThunk(
  'post/deleteComment',
  async ({ postId, commentId }, { rejectWithValue }) => {
    try {
      await api.delete(`/posts/${postId}/comment/${commentId}`);
      return { postId, commentId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete comment');
    }
  }
);

export const deletePost = createAsyncThunk(
  'post/deletePost',
  async (postId, { rejectWithValue }) => {
    try {
      await api.delete(`/posts/${postId}`);
      return postId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete post');
    }
  }
);

export const sharePost = createAsyncThunk(
  'post/sharePost',
  async (postId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/posts/${postId}/share`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to share post');
    }
  }
);

export const searchPosts = createAsyncThunk(
  'post/searchPosts',
  async (searchParams, { rejectWithValue }) => {
    try {
      const response = await api.get('/posts/search', { params: searchParams });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Post search failed');
    }
  }
);

// Admin functionality
export const getPosts = createAsyncThunk(
  'post/getPosts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/admin/posts');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch posts');
    }
  }
);

export const getPostsAdmin = createAsyncThunk(
  'post/getPostsAdmin',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/admin/posts');
      return response.data.posts || [];
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch posts');
    }
  }
);

const initialState = {
  posts: [],
  feed: [],
  userPosts: [],
  searchResults: [],
  loading: false,
  error: null,
  currentPost: null,
  pagination: {
    current: 1,
    total: 1,
    hasNext: false,
    hasPrev: false
  }
};

const postSlice = createSlice({
  name: 'post',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    setCurrentPost: (state, action) => {
      state.currentPost = action.payload;
    },
    clearCurrentPost: (state) => {
      state.currentPost = null;
    },
    addPostToFeed: (state, action) => {
      state.feed.unshift(action.payload);
    },
    updatePostInFeed: (state, action) => {
      const index = state.feed.findIndex(post => post._id === action.payload._id);
      if (index !== -1) {
        state.feed[index] = action.payload;
      }
    },
    removePostFromFeed: (state, action) => {
      state.feed = state.feed.filter(post => post._id !== action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      // Create post
      .addCase(createPost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.loading = false;
        state.feed.unshift(action.payload);
      })
      .addCase(createPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get feed
      .addCase(getFeed.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getFeed.fulfilled, (state, action) => {
        state.loading = false;
        console.log('Feed data received:', action.payload);
        // Handle new response format with posts and pagination
        if (action.payload && action.payload.posts) {
          state.feed = action.payload.posts;
          state.pagination = action.payload.pagination || {};
        } else {
          // Fallback for old format
          state.feed = action.payload;
        }
      })
      .addCase(getFeed.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get user posts
      .addCase(getUserPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.userPosts = action.payload;
      })
      .addCase(getUserPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Like post
      .addCase(likePost.fulfilled, (state, action) => {
        const { postId, isLiked, currentUserId } = action.payload;
        const post = state.feed.find(p => p._id === postId);
        if (post) {
          if (isLiked) {
            if (!post.likes.includes(currentUserId)) {
              post.likes.push(currentUserId);
            }
          } else {
            post.likes = post.likes.filter(id => id !== currentUserId);
          }
        }
      })
      // Add comment
      .addCase(addComment.fulfilled, (state, action) => {
        const { postId, comment } = action.payload;
        const post = state.feed.find(p => p._id === postId);
        if (post) {
          if (!Array.isArray(post.comments)) post.comments = [];
          post.comments.push(comment);
        }
      })
      // Delete comment
      .addCase(deleteComment.fulfilled, (state, action) => {
        const { postId, commentId } = action.payload;
        const post = state.feed.find(p => p._id === postId);
        if (post) {
          post.comments = post.comments.filter(c => c._id !== commentId);
        }
      })
      // Share post
      .addCase(sharePost.fulfilled, (state, action) => {
        const { sharedPost } = action.payload;
        state.feed.unshift(sharedPost);
      })
      // Delete post
      .addCase(deletePost.fulfilled, (state, action) => {
        const postId = action.payload;
        state.feed = state.feed.filter(post => post._id !== postId);
        state.userPosts = state.userPosts.filter(post => post._id !== postId);
      })
      // Search posts
      .addCase(searchPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Admin functionality
      .addCase(getPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.posts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Admin functionality
      .addCase(getPostsAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getPostsAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.posts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getPostsAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const {
  clearError,
  clearSearchResults,
  setCurrentPost,
  clearCurrentPost,
  addPostToFeed,
  updatePostInFeed,
  removePostFromFeed
} = postSlice.actions;

export default postSlice.reducer;
