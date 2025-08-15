import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import postReducer from './slices/postSlice';
import messageReducer from './slices/messageSlice';
import jobReducer from './slices/jobSlice';
import socketReducer from './slices/socketSlice';
import uiReducer from './slices/uiSlice';
import notificationReducer from './slices/notificationSlice';

console.log('Initializing Redux store...');

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    post: postReducer,
    message: messageReducer,
    job: jobReducer,
    socket: socketReducer,
    ui: uiReducer,
    notification: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['socket/setSocket'],
        ignoredPaths: ['socket.socket'],
      },
    }),
});

console.log('Redux store initialized successfully');

export default store;
