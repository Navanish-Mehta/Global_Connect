import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  getNetworkUsers,
  getConnections, 
  getConnectionRequests, 
  sendConnectionRequest, 
  acceptConnectionRequest, 
  rejectConnectionRequest,
  searchUsersWithStatus, 
  removeConnection
} from '../redux/slices/userSlice';

const Network = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { 
    connections, 
    connectionRequests, 
    searchResults, 
    networkUsers,
    loading,
    pagination
  } = useSelector((state) => state.user);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('people');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user) {
      // Always fetch network users on load
      dispatch(getNetworkUsers({ page: currentPage }));
      dispatch(getConnections());
      dispatch(getConnectionRequests());
    }
  }, [dispatch, user, currentPage]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Debounced search function
  const debouncedSearch = useCallback((query) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(async () => {
      if (query.trim()) {
        await dispatch(searchUsersWithStatus({ query, page: 1 }));
        setCurrentPage(1);
      } else {
        // If search is cleared, show all network users
        dispatch(getNetworkUsers({ page: 1 }));
        setCurrentPage(1);
      }
    }, 500); // 500ms delay
    
    setSearchTimeout(timeout);
  }, [dispatch, searchTimeout]);

  // Handle search input change with debouncing
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (!query.trim()) {
      // Immediately show all users when search is cleared
      dispatch(getNetworkUsers({ page: 1 }));
      setCurrentPage(1);
    } else {
      debouncedSearch(query);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await dispatch(searchUsersWithStatus({ query: searchQuery, page: 1 }));
      setCurrentPage(1);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      await dispatch(sendConnectionRequest(userId)).unwrap();
      toast.success('Connection request sent!');
      // Refresh network users to update connection status
      if (searchQuery.trim()) {
        dispatch(searchUsersWithStatus({ query: searchQuery, page: currentPage }));
      } else {
        dispatch(getNetworkUsers({ page: currentPage }));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (userId) => {
    try {
      await dispatch(acceptConnectionRequest(userId)).unwrap();
      toast.success('Connection request accepted!');
      // Refresh all data
      await Promise.all([
        dispatch(getConnections()),
        dispatch(getConnectionRequests()),
        dispatch(getNetworkUsers({ page: currentPage }))
      ]);
      // Open chat immediately without reload
      navigate(`/dashboard/messages?user=${userId}`);
    } catch (error) {
      toast.error(error.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      await dispatch(rejectConnectionRequest(userId)).unwrap();
      toast.success('Connection request rejected');
      // Refresh requests
      dispatch(getConnectionRequests());
    } catch (error) {
      toast.error(error.message || 'Failed to reject request');
    }
  };

  const handleRemoveConnection = async (userId) => {
    try {
      await dispatch(removeConnection(userId)).unwrap();
      toast.success('Connection removed');
      // Refresh all data
      await Promise.all([
        dispatch(getConnections()),
        dispatch(getNetworkUsers({ page: currentPage }))
      ]);
    } catch (error) {
      toast.error(error.message || 'Failed to remove connection');
    }
  };

  const getConnectionButton = (user) => {
    const status = user.connectionStatus;
    
    switch (status) {
      case 'connected':
        return (
          <div className="flex gap-2">
            <span className="bg-green-100 text-green-800 px-3 py-2 rounded-lg text-sm font-medium">
              Connected
            </span>
            <button
              onClick={() => handleRemoveConnection(user._id)}
              className="bg-red-100 text-red-800 px-3 py-2 rounded-lg hover:bg-red-200 transition-all duration-200 text-sm font-medium"
            >
              Remove
            </button>
          </div>
        );
      case 'requested':
        return (
          <span className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm font-medium">
            Request Sent
          </span>
        );
      case 'pending':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleAcceptRequest(user._id)}
              className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium"
            >
              Accept
            </button>
            <button
              onClick={() => handleRejectRequest(user._id)}
              className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium"
            >
              Reject
            </button>
          </div>
        );
      default:
        return (
          <button
            onClick={() => handleSendRequest(user._id)}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          >
            Connect
          </button>
        );
    }
  };

  const displayUsers = searchQuery.trim() ? searchResults : networkUsers;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Please log in to view your network</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Network</h1>
          <p className="text-gray-600">Connect with professionals and grow your network</p>
        </div>
        
        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Find People</h2>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, skills, or company..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-4 py-3 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <svg className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md hover:shadow-lg"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </div>
              ) : (
                'Search'
              )}
            </button>
          </div>
          
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Results</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((user) => (
                  <div key={user._id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                        {user.profilePic ? (
                          <img
                            src={user.profilePic}
                            alt={user.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-semibold">{user.name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{user.name}</h4>
                        <p className="text-sm text-gray-600">{user.bio || 'No bio available'}</p>
                      </div>
                    </div>
                    
                    {user.skills && user.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {user.skills.slice(0, 3).map((skill, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                            {skill}
                          </span>
                        ))}
                        {user.skills.length > 3 && (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                            +{user.skills.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                    
                    {getConnectionButton(user)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex space-x-8 mb-6">
            <button
              onClick={() => setActiveTab('people')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'people' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              People
            </button>
            <button
              onClick={() => setActiveTab('connections')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'connections' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              Connections ({connections.length})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'requests' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              Pending Requests ({connectionRequests.length})
            </button>
          </div>

          {activeTab === 'people' && (
            <div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayUsers.filter(u => u._id !== user._id).map((person) => (
                  <div key={person._id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                        {person.profilePic ? (
                          <img src={person.profilePic} alt={person.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <span className="text-white font-semibold">{person.name?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{person.name}</h4>
                        <p className="text-sm text-gray-600">{person.bio || 'No bio available'}</p>
                      </div>
                    </div>
                    {person.skills && person.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {person.skills.slice(0, 3).map((skill, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">{skill}</span>
                        ))}
                        {person.skills.length > 3 && (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">+{person.skills.length - 3} more</span>
                        )}
                      </div>
                    )}
                    {getConnectionButton(person)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div>
              {connections.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connections.map((connection) => (
                    <div key={connection._id} className="border rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <img
                          src={connection.profilePic || '/default-avatar.svg'}
                          alt={connection.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <h4 className="font-semibold text-gray-900">{connection.name}</h4>
                          <p className="text-sm text-gray-600">{connection.bio}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => navigate(`/dashboard/messages?user=${connection._id}`)}
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium flex-1"
                        >
                          Message
                        </button>
                        <button 
                          onClick={() => navigate(`/dashboard/profile/${connection._id}`)}
                          className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-all duration-200 text-sm font-medium"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  You haven't made any connections yet. Start by searching for people and sending connection requests!
                </p>
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div>
              {connectionRequests.length > 0 ? (
                <div className="space-y-4">
                  {connectionRequests.map((request) => (
                    <div key={request._id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            src={request.from.profilePic || '/default-avatar.svg'}
                            alt={request.from.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div>
                            <h4 className="font-semibold text-gray-900">{request.from.name}</h4>
                            <p className="text-sm text-gray-600">{request.from.bio}</p>
                            <p className="text-xs text-gray-500">
                              Sent {new Date(request.sentAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAcceptRequest(request._id)}
                            className="btn btn-primary btn-sm"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request._id)}
                            className="btn btn-outline btn-sm"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No pending connection requests
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Network;
