import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  socket: null,
  connected: false,
  error: null
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    setSocket: (state, action) => {
      state.socket = action.payload;
      state.connected = !!action.payload;
    },
    setConnected: (state, action) => {
      state.connected = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const { setSocket, setConnected, setError, clearError } = socketSlice.actions;
export default socketSlice.reducer;
