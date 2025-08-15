import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getCurrentUser } from '../redux/slices/authSlice';
import { toast } from 'react-hot-toast';
import api from '../utils/axios';
import { uploadProfilePicture, uploadBannerPicture, updateProfile as updateProfileThunk } from '../redux/slices/userSlice';

const Profile = () => {
  const { userId } = useParams();
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.auth);
  
  const [userProfile, setUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    bio: '',
    location: '',
    skills: '',
    experience: '',
    education: ''
  });

  // Determine which user to display
  const targetUserId = userId || currentUser?._id;
  const isOwnProfile = !userId || userId === currentUser?._id;

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await api.get(`/users/${targetUserId}`);
      setUserProfile(response.data.user);
      setEditForm({
        name: response.data.user.name || '',
        bio: response.data.user.bio || '',
        location: response.data.user.location || '',
        skills: response.data.user.skills?.join(', ') || '',
        experience: response.data.user.experience || '',
        education: response.data.user.education || ''
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Failed to load profile');
    }
  }, [targetUserId]);

  const fetchUserPosts = useCallback(async () => {
    try {
      const response = await api.get(`/users/${targetUserId}/posts`);
      setUserPosts(response.data.posts || []);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (!currentUser) {
      dispatch(getCurrentUser());
      return;
    }

    if (targetUserId) {
      fetchUserProfile();
      fetchUserPosts();
    }
  }, [dispatch, currentUser, targetUserId, fetchUserProfile, fetchUserPosts]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        ...editForm,
        userId: targetUserId,
        skills: editForm.skills.split(',').map(skill => skill.trim()).filter(Boolean)
      };

      await dispatch(updateProfileThunk(updateData)).unwrap();
      await fetchUserProfile();
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleProfilePicChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Image size should be less than 5MB');
      return;
    }
    
    try {
      const resultAction = await dispatch(uploadProfilePicture({ userId: targetUserId, file })).unwrap();
      setUserProfile(prev => ({ ...prev, profilePic: resultAction.profilePic }));
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to upload profile picture');
    }
  };

  const handleBannerPicChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('Image size should be less than 10MB');
      return;
    }
    
    try {
      const resultAction = await dispatch(uploadBannerPicture({ userId: targetUserId, file })).unwrap();
      setUserProfile(prev => ({ ...prev, bannerPic: resultAction.bannerPic }));
      toast.success('Banner picture updated!');
    } catch (error) {
      toast.error(error.message || 'Failed to upload banner picture');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Banner Image */}
        <div className="relative mb-6">
          <div className="h-48 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl overflow-hidden">
            {userProfile.bannerPic ? (
              <img
                src={userProfile.bannerPic}
                alt="Banner"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = '/default-banner.svg';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600"></div>
            )}
          </div>
          {/* Profile Picture Overlay */}
          <div className="absolute -bottom-16 left-8">
            <div className="relative w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
              {userProfile.profilePic ? (
                <img src={userProfile.profilePic} alt="Profile" className="w-32 h-32 rounded-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white">{userProfile.name?.charAt(0).toUpperCase()}</span>
              )}
              {isOwnProfile && isEditing && (
                <>
                  <input type="file" accept="image/*" onChange={handleProfilePicChange} className="hidden" id="profile-pic-upload" />
                  <label htmlFor="profile-pic-upload" className="absolute bottom-2 right-2 bg-white p-2 rounded-full shadow cursor-pointer hover:bg-blue-100">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13h6m2 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  </label>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6 mt-16">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{userProfile.name}</h1>
              <p className="text-gray-600 text-lg mb-4">{userProfile.bio || 'No bio available'}</p>
              
              <div className="space-y-2">
                {userProfile.location && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-gray-600">{userProfile.location}</span>
                  </div>
                )}
                {userProfile.email && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-600">{userProfile.email}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-600">Joined {new Date(userProfile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            {isOwnProfile && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            )}
          </div>
        </div>

        {/* Edit Profile Form */}
        {isEditing && isOwnProfile && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Profile</h2>
            <form onSubmit={handleUpdateProfile}>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Skills (comma separated)</label>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={(e) => setEditForm({...editForm, skills: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., JavaScript, React, Node.js"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                <textarea
                  value={editForm.experience}
                  onChange={(e) => setEditForm({...editForm, experience: e.target.value})}
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your work experience..."
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Education</label>
                <textarea
                  value={editForm.education}
                  onChange={(e) => setEditForm({...editForm, education: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your educational background..."
                />
              </div>

              {isOwnProfile && isEditing && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img
                        src={userProfile?.profilePic || '/default-avatar.svg'}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover border-4 border-gray-200"
                        onError={(e) => {
                          e.target.src = '/default-avatar.svg';
                        }}
                      />
                      <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePicChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Upload a professional photo</p>
                      <p className="text-xs text-gray-500">JPG, PNG or GIF. Max 5MB.</p>
                    </div>
                  </div>
                </div>
              )}

              {isOwnProfile && isEditing && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banner Image</label>
                  <div className="relative">
                    <img
                      src={userProfile?.bannerPic || '/default-banner.svg'}
                      alt="Banner"
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      onError={(e) => {
                        e.target.src = '/default-banner.svg';
                      }}
                    />
                    <label className="absolute top-2 right-2 bg-white bg-opacity-90 text-gray-700 p-2 rounded-lg cursor-pointer hover:bg-opacity-100 transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerPicChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Recommended size: 1200x300px. Max 10MB.</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Skills Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Skills</h2>
          </div>
          {userProfile.skills && userProfile.skills.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {userProfile.skills.map((skill, index) => (
                <span key={index} className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium shadow-sm">
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">⚡</div>
              <p className="text-gray-500">No skills listed</p>
              <p className="text-sm text-gray-400">Add your skills to highlight your expertise</p>
            </div>
          )}
        </div>

        {/* Experience Section */}
        {userProfile.experience && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Experience</h2>
            </div>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{userProfile.experience}</p>
            </div>
          </div>
        )}

        {/* Education Section */}
        {userProfile.education && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Education</h2>
            </div>
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{userProfile.education}</p>
            </div>
          </div>
        )}

        {/* Posts Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Posts by {userProfile.name}</h2>
          </div>
          {userPosts.length > 0 ? (
            <div className="space-y-4">
              {userPosts.map((post) => (
                <div key={post._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-700">{post.content}</p>
                  {post.images && post.images.length > 0 && (
                    <div className="mt-3 flex space-x-2">
                      {post.images.slice(0, 3).map((image, index) => (
                        <img key={index} src={image} alt="Post" className="w-20 h-20 object-cover rounded" />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📝</div>
              <p className="text-gray-500">No posts yet</p>
              <p className="text-sm text-gray-400">Start sharing your thoughts and experiences</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
