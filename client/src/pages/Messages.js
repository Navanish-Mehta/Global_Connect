import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { 
  getConversations, 
  getConversation, 
  sendMessage, 
  markConversationAsRead,
  addMessage 
} from '../redux/slices/messageSlice';
import { setCurrentConversation } from '../redux/slices/messageSlice';
import { getConnections } from '../redux/slices/userSlice';

const Messages = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { conversations, messages, loading, error } = useSelector((state) => state.message);
  const { connections } = useSelector((state) => state.user);
  const { socket } = useSelector((state) => state.socket);
  
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const messagesEndRef = useRef(null);
  const [typing, setTyping] = useState(false);

  // Define handleConversationSelect before it's used
  const handleConversationSelect = useCallback((conversation) => {
    // keep reducer in sync for real-time append
    dispatch(setCurrentConversation(conversation));
    setSelectedConversation(conversation);
    // Mark messages as read
    if (conversation.unreadCount > 0) {
      dispatch(markConversationAsRead(conversation._id));
    }
  }, [dispatch]);

  // Get all users for admin (not just connections) - declared before use
  const getAllUsers = () => {
    if (user?.role === 'admin') {
      // For admin, show all users in the system
      return connections || [];
    }
    // For regular users, show only connections
    return connections || [];
  };

  // Initialize data only once when component mounts
  useEffect(() => {
    if (user && !isInitialized && retryCount < 3 && !hasError) {
      const initializeData = async () => {
        try {
          // First try to get connections
          await dispatch(getConnections()).unwrap();
          
          // Then try to get conversations
          try {
            await dispatch(getConversations()).unwrap();
          } catch (convError) {
            // If conversations fail with 403, that's okay - user has no connections
            if (convError.includes('You can only view messages with your connections') || 
                convError.includes('403') || 
                convError.includes('Forbidden')) {
              console.log('User has no connections yet - showing empty state');
            } else {
              throw convError; // Re-throw other errors
            }
          }
          
          setIsInitialized(true);
          setRetryCount(0); // Reset retry count on success
          setHasError(false); // Reset error state on success
        } catch (error) {
          console.error('Failed to initialize messages data:', error);
          // Handle 403 errors gracefully - show empty state instead of breaking
          if (error.includes('You can only view messages with your connections') || 
              error.includes('403') || 
              error.includes('Forbidden')) {
            setIsInitialized(true); // Mark as initialized to prevent infinite retries
            setHasError(false); // Don't treat this as an error
            if (user?.role === 'admin') {
              toast.error('Failed to load admin data. Please refresh the page.');
            } else {
              // Show friendly message instead of error
              console.log('User has no connections yet - showing empty state');
            }
          } else {
            setRetryCount(prev => prev + 1);
            if (retryCount >= 2) {
              setHasError(true);
              toast.error('Failed to load messages. Please refresh the page.');
            }
          }
        }
      };
      
      initializeData();
    }
  }, [dispatch, user, isInitialized, retryCount, hasError]);

  // Handle URL parameters after initialization
  useEffect(() => {
    if (isInitialized && connections.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('user');
      if (userId) {
        // Find the user in connections or create a conversation object
        const connection = connections.find(conn => conn._id === userId);
        if (connection) {
          handleConversationSelect({
            _id: connection._id,
            user: connection,
            messages: []
          });
        }
      }
    }
  }, [isInitialized, connections, handleConversationSelect]);

  // Handle conversation selection
  useEffect(() => {
    if (selectedConversation && isInitialized) {
      dispatch(getConversation({
        userId: selectedConversation._id
      }));
      // Mark conversation as read
      dispatch(markConversationAsRead(selectedConversation._id));
    }
  }, [dispatch, selectedConversation, isInitialized]);

  // Socket event listeners
  useEffect(() => {
    if (socket && isInitialized) {
      // Listen for incoming messages
      socket.on('message:new', (data) => {
        console.log('New message received:', data);
        dispatch(addMessage(data));
        // Don't automatically refresh conversations to prevent infinite loops
        // Conversations will be updated when user navigates or manually refreshes
      });

      // Listen for typing indicators
      socket.on('user_typing', (data) => {
        if (data.userId === selectedConversation?._id) {
          setTyping(data.isTyping);
        }
      });

      return () => {
        socket.off('message:new');
        socket.off('user_typing');
      };
    }
  }, [socket, selectedConversation, dispatch, isInitialized, loading]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Error handling - prevent infinite retries
  useEffect(() => {
    if (error && !isInitialized && retryCount >= 3) {
      console.error('Messages error:', error);
      setHasError(true);
      setIsInitialized(true); // Mark as initialized to stop retries
      if (error.includes('You can only view messages with your connections') || 
          error.includes('403') || 
          error.includes('Forbidden')) {
        // Don't show error toast for 403 - just show empty state
        console.log('User has no connections yet - showing empty state');
      } else {
        toast.error('Failed to load messages. Please refresh the page.');
      }
    }
  }, [error, isInitialized, retryCount]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    try {
      const messageData = {
        receiverId: selectedConversation._id,
        content: messageText.trim(),
        messageType: 'text'
      };

      await dispatch(sendMessage(messageData)).unwrap();
      setMessageText('');
    } catch (error) {
      toast.error(error || 'Failed to send message');
    }
  };

  const handleTyping = () => {
    if (socket && selectedConversation) {
      socket.emit('typing', {
        receiverId: selectedConversation._id,
        isTyping: true
      });
      
      // Stop typing indicator after 1 second
      setTimeout(() => {
        socket.emit('typing', {
          receiverId: selectedConversation._id,
          isTyping: false
        });
      }, 1000);
    }
  };

  // Filter conversations based on search and user role
  const filteredConversations = conversations.filter(conv => 
    conv.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter users based on search query
  const filteredUsers = getAllUsers().filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Please log in to view messages</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Failed to Load Messages</h2>
          <p className="text-gray-600 mb-4">There was an error loading your messages.</p>
          <button
            onClick={() => {
              setHasError(false);
              setRetryCount(0);
              setIsInitialized(false);
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!isInitialized && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Messages</h1>
          <p className="text-gray-600">Connect with your network through private messaging</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="flex h-[600px]">
            {/* Conversations List */}
            <div className="w-1/3 border-r border-gray-200">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={user?.role === 'admin' ? "Search conversations and users..." : "Search conversations..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white"
                  />
                  <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              <div className="overflow-y-auto h-full">
                {filteredConversations.length > 0 ? (
                  <div className="space-y-1">
                    {filteredConversations.map((conversation) => (
                      <div
                        key={conversation._id}
                        onClick={() => handleConversationSelect(conversation)}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-all duration-200 ${
                          selectedConversation?._id === conversation._id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                            {conversation.user?.profilePic ? (
                              <img
                                src={conversation.user.profilePic}
                                alt={conversation.user.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-semibold">{conversation.user?.name?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {conversation.user?.name}
                              </h4>
                              {conversation.unreadCount > 0 && (
                                <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 font-medium">
                                  {conversation.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate mb-1">
                              {conversation.lastMessage?.content || 'No messages yet'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {conversation.lastMessage?.createdAt 
                                ? new Date(conversation.lastMessage.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : ''
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <div className="text-2xl mb-2">💬</div>
                    <p className="text-sm">No conversations yet</p>
                  </div>
                )}

                {/* Connected Users Section */}
                {filteredUsers && filteredUsers.length > 0 && (
                  <div className="mt-6">
                    <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
                      <h3 className="text-sm font-medium text-gray-700">
                        {user?.role === 'admin' ? 'All Users' : 'Connected Users'}
                      </h3>
                    </div>
                    <div className="space-y-1">
                      {filteredUsers.map((connection) => {
                        // Check if this connection already has a conversation
                        const hasConversation = conversations.some(conv => conv._id === connection._id);
                        
                        if (!hasConversation) {
                          return (
                            <div
                              key={connection._id}
                              onClick={() => handleConversationSelect({
                                _id: connection._id,
                                user: connection,
                                messages: []
                              })}
                              className="p-4 cursor-pointer hover:bg-gray-50 transition-all duration-200"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                                  {connection.profilePic ? (
                                    <img
                                      src={connection.profilePic}
                                      alt={connection.name}
                                      className="w-12 h-12 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-white font-semibold">{connection.name?.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 truncate">
                                    {connection.name}
                                  </h4>
                                  <p className="text-sm text-gray-600 truncate">
                                    Click to start chatting
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                        {selectedConversation.user?.profilePic ? (
                          <img
                            src={selectedConversation.user.profilePic}
                            alt={selectedConversation.user.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-semibold">{selectedConversation.user?.name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{selectedConversation.user?.name}</h3>
                        {typing && (
                          <p className="text-sm text-blue-600 italic">typing...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : messages && messages.length > 0 ? (
                      messages.map((message, index) => {
                        // Determine if message is from current user
                        const isOwnMessage = message.senderId === user._id || 
                                           message.senderId?._id === user._id ||
                                           (typeof message.senderId === 'string' && message.senderId === user._id);
                        
                        return (
                          <div
                            key={message._id || index}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                                isOwnMessage
                                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-md'
                                  : 'bg-gray-100 text-gray-900 rounded-bl-md'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{message.content}</p>
                              <p className={`text-xs mt-2 ${
                                isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                              }`}>
                                {new Date(message.createdAt || message.timestamp).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <div className="text-4xl mb-2">💬</div>
                        <p>No messages yet</p>
                        <p className="text-sm">Start a conversation!</p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleSendMessage();
                          }
                        }}
                        onInput={handleTyping}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageText.trim()}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-xl">Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
