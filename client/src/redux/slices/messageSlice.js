import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/axios';

// Async thunks
export const sendMessage = createAsyncThunk(
  'message/sendMessage',
  async (messageData, { rejectWithValue }) => {
    try {
      const response = await api.post('/messages', messageData);
      // Align with backend shape { message: '...', data: message }
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send message');
    }
  }
);

export const getConversation = createAsyncThunk(
  'message/getConversation',
  async ({ userId, page = 1, limit = 50 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/messages/conversation/${userId}?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get conversation');
    }
  }
);

export const getConversations = createAsyncThunk(
  'message/getConversations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/messages/conversations');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get conversations');
    }
  }
);

export const markConversationAsRead = createAsyncThunk(
  'message/markConversationAsRead',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/messages/conversation/${userId}/read`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark conversation as read');
    }
  }
);

const initialState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  loading: false,
  error: null,
  unreadCount: 0
};

const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentConversation: (state, action) => {
      state.currentConversation = action.payload;
    },
    addMessage: (state, action) => {
      const message = action.payload;
      // Add to current conversation if it matches
      if (state.currentConversation && (
        message.senderId === state.currentConversation._id ||
        message.receiverId === state.currentConversation._id
      )) {
        state.messages.push(message);
      }
      
      // Update conversations list
      const conversationIndex = state.conversations.findIndex(conv => 
        conv._id === message.senderId || conv._id === message.receiverId
      );
      
      if (conversationIndex !== -1) {
        state.conversations[conversationIndex].lastMessage = message;
        // Move conversation to top
        const conversation = state.conversations.splice(conversationIndex, 1)[0];
        state.conversations.unshift(conversation);
      }
    },
    updateUnreadCount: (state, action) => {
      const { conversationId, count } = action.payload;
      const conversationIndex = state.conversations.findIndex(conv => conv._id === conversationId);
      if (conversationIndex !== -1) {
        state.conversations[conversationIndex].unreadCount = count;
      }
    },
    markMessageAsRead: (state, action) => {
      const { messageId } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg._id === messageId);
      if (messageIndex !== -1) {
        state.messages[messageIndex].isRead = true;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Send message
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        // Add the message immediately to the state for instant display
        const message = action.payload;
        if (message) {
          // Add to current conversation if it matches
          if (state.currentConversation && (
            message.senderId === state.currentConversation._id ||
            message.receiverId === state.currentConversation._id
          )) {
            state.messages.push(message);
          }
          
          // Update conversations list
          const conversationIndex = state.conversations.findIndex(conv => 
            conv._id === message.senderId || conv._id === message.receiverId
          );
          
          if (conversationIndex !== -1) {
            state.conversations[conversationIndex].lastMessage = message;
            // Move conversation to top
            const conversation = state.conversations.splice(conversationIndex, 1)[0];
            state.conversations.unshift(conversation);
          }
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get conversations
      .addCase(getConversations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload.conversations || [];
      })
      .addCase(getConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get conversation
      .addCase(getConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload.messages || [];
      })
      .addCase(getConversation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Mark conversation as read
      .addCase(markConversationAsRead.fulfilled, (state, action) => {
        // Update unread count for the conversation
        const { conversationId } = action.payload;
        const conversationIndex = state.conversations.findIndex(conv => conv._id === conversationId);
        if (conversationIndex !== -1) {
          state.conversations[conversationIndex].unreadCount = 0;
        }
      });
  }
});

export const { 
  clearError, 
  setCurrentConversation, 
  addMessage, 
  updateUnreadCount, 
  markMessageAsRead 
} = messageSlice.actions;

export default messageSlice.reducer;
