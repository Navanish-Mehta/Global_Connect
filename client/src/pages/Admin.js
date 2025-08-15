import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { logout } from '../redux/slices/authSlice';
import { getUsers, deleteUser, banUser, unbanUser } from '../redux/slices/userSlice';
import { getPostsAdmin, deletePost } from '../redux/slices/postSlice';
import { getJobsAdmin, createJob, deleteJob, updateApplicationStatus } from '../redux/slices/jobSlice';

const Admin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { users, loading: usersLoading } = useSelector((state) => state.user);
  const { posts, loading: postsLoading } = useSelector((state) => state.post);
  const { jobs, loading: jobsLoading } = useSelector((state) => state.job);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobApplications, setJobApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [jobFormData, setJobFormData] = useState({
    title: '',
    company: '',
    location: '',
    description: '',
    requirements: '',
    responsibilities: '',
    skills: '',
    jobType: 'full-time',
    experienceLevel: 'entry',
    salary: { min: '', max: '' },
    contactEmail: '',
    applicationDeadline: '',
    isRemote: false,
    isUrgent: false
  });

  useEffect(() => {
    if (user && user.role === 'admin') {
      dispatch(getUsers());
      dispatch(getPostsAdmin());
      dispatch(getJobsAdmin());
    }
  }, [dispatch, user]);

  // Build applications table from current jobs list
  const loadJobApplications = useCallback(async () => {
    setApplicationsLoading(true);
    try {
      const applications = [];
      for (const job of jobs) {
        if (job.applications && job.applications.length > 0) {
          applications.push(...job.applications.map(app => ({
            ...app,
            jobTitle: job.title,
            jobCompany: job.company,
            jobLocation: job.location
          })));
        }
      }
      setJobApplications(applications);
    } catch (error) {
      console.error('Failed to load job applications:', error);
    } finally {
      setApplicationsLoading(false);
    }
  }, [jobs]);

  // Load job applications when applications tab is selected
  useEffect(() => {
    if (activeTab === 'applications' && jobs.length > 0) {
      loadJobApplications();
    }
  }, [activeTab, jobs, loadJobApplications]);

  const handleUpdateApplicationStatus = async (applicationId, status) => {
    try {
      // Find the job that contains this application
      const job = jobs.find(j => j.applications?.some(app => app._id === applicationId));
      if (!job) {
        toast.error('Job not found for this application');
        return;
      }
      
      await dispatch(updateApplicationStatus({ 
        jobId: job._id, 
        applicationId, 
        status 
      })).unwrap();
      
      toast.success(`Application status updated to ${status}!`);
      loadJobApplications(); // Refresh applications list
    } catch (error) {
      toast.error('Failed to update application status');
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await dispatch(deleteUser(userId)).unwrap();
        toast.success('User deleted successfully');
      } catch (error) {
        toast.error('Failed to delete user');
      }
    }
  };

  const handleBanUser = async (userId) => {
    try {
      await dispatch(banUser(userId)).unwrap();
      toast.success('User status updated successfully');
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await dispatch(unbanUser(userId)).unwrap();
      toast.success('User status updated successfully');
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await dispatch(deletePost(postId)).unwrap();
        toast.success('Post deleted successfully');
      } catch (error) {
        toast.error('Failed to delete post');
      }
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await dispatch(deleteJob(jobId)).unwrap();
        toast.success('Job deleted successfully');
      } catch (error) {
        toast.error('Failed to delete job');
      }
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!jobFormData.title || !jobFormData.company || !jobFormData.description || 
        !jobFormData.location || !jobFormData.applicationDeadline) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate salary
    if (parseInt(jobFormData.salary.min) >= parseInt(jobFormData.salary.max)) {
      toast.error('Maximum salary must be greater than minimum salary');
      return;
    }

    // Validate application deadline
    if (new Date(jobFormData.applicationDeadline) <= new Date()) {
      toast.error('Application deadline must be in the future');
      return;
    }

    try {
      const jobData = {
        title: jobFormData.title,
        company: jobFormData.company,
        description: jobFormData.description,
        location: jobFormData.location,
        jobType: jobFormData.jobType,
        experienceLevel: jobFormData.experienceLevel,
        skills: jobFormData.skills.split(',').map(skill => skill.trim()).filter(Boolean),
        requirements: jobFormData.requirements.split('\n').map(req => req.trim()).filter(Boolean),
        responsibilities: jobFormData.responsibilities.split('\n').map(resp => resp.trim()).filter(Boolean),
        salary: {
          min: parseInt(jobFormData.salary.min) || 0,
          max: parseInt(jobFormData.salary.max) || 0
        },
        applicationDeadline: jobFormData.applicationDeadline,
        isRemote: jobFormData.isRemote || false,
        isUrgent: jobFormData.isUrgent || false
      };
      
      await dispatch(createJob(jobData)).unwrap();
      setShowJobForm(false);
      setJobFormData({
        title: '', company: '', location: '', description: '', requirements: '',
        responsibilities: '', skills: '', jobType: 'full-time', experienceLevel: 'entry',
        salary: { min: '', max: '' }, applicationDeadline: '', isRemote: false, isUrgent: false
      });
      toast.success('Job posted successfully!');
      dispatch(getJobsAdmin()); // Refresh jobs list
    } catch (error) {
      toast.error(error.message || 'Failed to post job');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const stats = {
    totalUsers: (Array.isArray(users) ? users : []).length || 0,
    totalPosts: (Array.isArray(posts) ? posts : []).length || 0,
    totalJobs: (Array.isArray(jobs) ? jobs : []).length || 0,
    activeUsers: (Array.isArray(users) ? users : []).filter(u => u.isActive)?.length || 0
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your platform and monitor activity</p>
        </div>

        {/* Navbar */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8 p-4 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-2xl mr-2">👋</span>
            <span className="text-lg font-semibold text-gray-900">{user.name}</span>
            <span className="mx-2 text-gray-600">|</span>
            <span className="text-lg text-gray-600">Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200"
          >
            Logout
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPosts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: '📊' },
                { id: 'users', name: 'Users', icon: '👥' },
                { id: 'posts', name: 'Posts', icon: '📝' },
                { id: 'jobs', name: 'Jobs', icon: '💼' },
                { id: 'applications', name: 'Applications', icon: '📄' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900">Platform Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Recent Activity</h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">New user registered</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">New post created</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">New job posted</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Quick Actions</h4>
                    <div className="space-y-3">
                      <button 
                        onClick={() => setActiveTab('users')}
                        className="w-full text-left px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200"
                      >
                        View All Users
                      </button>
                      <button 
                        onClick={() => setActiveTab('posts')}
                        className="w-full text-left px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200"
                      >
                        Review Posts
                      </button>
                      <button 
                        onClick={() => setActiveTab('jobs')}
                        className="w-full text-left px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors duration-200"
                      >
                        Manage Jobs
                      </button>
                      <button 
                        onClick={() => setActiveTab('applications')}
                        className="w-full text-left px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors duration-200"
                      >
                        View Applications
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Manage Users</h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {usersLoading ? (
                  <div className="text-center py-8">
                    <div className="text-xl">Loading users...</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skills</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(Array.isArray(filteredUsers) ? filteredUsers : []).map((user) => (
                          <tr key={user._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                  {user.profilePic ? (
                                    <img src={user.profilePic} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    <span className="text-white font-semibold">{user.name?.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                  <div className="text-sm text-gray-500">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.skills?.join(', ')}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {user.isActive ? 'Active' : 'Banned'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                {user.isActive ? (
                                  <button
                                    onClick={() => handleBanUser(user._id)}
                                    className="text-yellow-600 hover:text-yellow-900 text-xs font-medium"
                                  >
                                    Ban
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUnbanUser(user._id)}
                                    className="text-green-600 hover:text-green-900 text-xs font-medium"
                                  >
                                    Unban
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteUser(user._id)}
                                  className="text-red-600 hover:text-red-900 text-xs font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Manage Posts</h3>
                {postsLoading ? (
                  <div className="text-center py-8">
                    <div className="text-xl">Loading posts...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(Array.isArray(posts) ? posts : []).map((post) => (
                      <div key={post._id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                {post.author?.profilePic ? (
                                  <img src={post.author.profilePic} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <span className="text-white text-sm font-semibold">{post.author?.name?.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="font-medium text-gray-900">{post.author?.name}</span>
                              <span className="text-sm text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-700">{post.content}</p>
                          </div>
                          <button
                            onClick={() => handleDeletePost(post._id)}
                            className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Jobs Tab */}
            {activeTab === 'jobs' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Manage Jobs</h3>
                  <button
                    onClick={() => setShowJobForm(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Add Job</span>
                    </div>
                  </button>
                </div>
                {showJobForm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                      <h2 className="text-2xl font-bold mb-4">Post New Job</h2>
                      <form onSubmit={handleCreateJob}>
                        <div className="grid md:grid-cols-2 gap-4">
                          <input type="text" placeholder="Job Title" value={jobFormData.title} onChange={e => setJobFormData({...jobFormData, title: e.target.value})} className="input" required />
                          <input type="text" placeholder="Company" value={jobFormData.company} onChange={e => setJobFormData({...jobFormData, company: e.target.value})} className="input" required />
                          <input type="text" placeholder="Location" value={jobFormData.location} onChange={e => setJobFormData({...jobFormData, location: e.target.value})} className="input" required />
                          <input type="email" placeholder="Contact Email" value={jobFormData.contactEmail} onChange={e => setJobFormData({...jobFormData, contactEmail: e.target.value})} className="input" />
                          <select value={jobFormData.jobType} onChange={e => setJobFormData({...jobFormData, jobType: e.target.value})} className="input">
                            <option value="full-time">Full Time</option>
                            <option value="part-time">Part Time</option>
                            <option value="contract">Contract</option>
                            <option value="internship">Internship</option>
                          </select>
                          <select value={jobFormData.experienceLevel} onChange={e => setJobFormData({...jobFormData, experienceLevel: e.target.value})} className="input">
                            <option value="entry">Entry Level</option>
                            <option value="mid">Mid Level</option>
                            <option value="senior">Senior Level</option>
                            <option value="executive">Executive</option>
                          </select>
                        </div>
                        <textarea placeholder="Job Description" value={jobFormData.description} onChange={e => setJobFormData({...jobFormData, description: e.target.value})} className="input mt-4" rows="4" required />
                        <textarea placeholder="Requirements (one per line)" value={jobFormData.requirements} onChange={e => setJobFormData({...jobFormData, requirements: e.target.value})} className="input mt-4" rows="3" />
                        <textarea placeholder="Responsibilities (one per line)" value={jobFormData.responsibilities} onChange={e => setJobFormData({...jobFormData, responsibilities: e.target.value})} className="input mt-4" rows="3" />
                        <input type="text" placeholder="Skills (comma separated)" value={jobFormData.skills} onChange={e => setJobFormData({...jobFormData, skills: e.target.value})} className="input mt-4" />
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          <input type="number" placeholder="Min Salary" value={jobFormData.salary.min} onChange={e => setJobFormData({...jobFormData, salary: {...jobFormData.salary, min: e.target.value}})} className="input" />
                          <input type="number" placeholder="Max Salary" value={jobFormData.salary.max} onChange={e => setJobFormData({...jobFormData, salary: {...jobFormData.salary, max: e.target.value}})} className="input" />
                        </div>
                        <input type="date" placeholder="Application Deadline" value={jobFormData.applicationDeadline} onChange={e => setJobFormData({...jobFormData, applicationDeadline: e.target.value})} className="input mt-4" required />
                        <div className="flex space-x-3 mt-6">
                          <button type="submit" className="btn btn-primary flex-1">Post Job</button>
                          <button type="button" onClick={() => setShowJobForm(false)} className="btn btn-outline flex-1">Cancel</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
                {jobsLoading ? (
                  <div className="text-center py-8">
                    <div className="text-xl">Loading jobs...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(Array.isArray(jobs) ? jobs : []).map((job) => (
                      <div key={job._id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{job.title}</h4>
                            <p className="text-gray-600">{job.company}</p>
                            <p className="text-gray-500 text-sm">{job.location}</p>
                            <p className="text-gray-700 mt-2">{job.description}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteJob(job._id)}
                            className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Applications Tab */}
            {activeTab === 'applications' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Manage Job Applications</h3>
                {applicationsLoading ? (
                  <div className="text-center py-8">
                    <div className="text-xl">Loading applications...</div>
                  </div>
                ) : jobApplications.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-xl text-gray-500">No job applications found</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applicant</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cover Letter</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resume</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {jobApplications.map((application) => (
                          <tr key={application._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{application.jobTitle}</div>
                                <div className="text-sm text-gray-500">{application.jobCompany}</div>
                                <div className="text-sm text-gray-500">{application.jobLocation}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{application.applicantId?.name || 'Unknown'}</div>
                                <div className="text-sm text-gray-500">{application.applicantId?.email || 'No email'}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="max-w-xs">
                                <p className="text-sm text-gray-900 line-clamp-3">
                                  {application.coverLetter || 'No cover letter'}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {application.resume ? (
                                <a
                                  href={application.resume}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                >
                                  Download Resume
                                </a>
                              ) : (
                                <span className="text-gray-500 text-sm">No resume</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(application.appliedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                application.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                application.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {application.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                {application.status === 'Pending' && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateApplicationStatus(application._id, 'Approved')}
                                      className="text-green-600 hover:text-green-900 text-xs font-medium"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleUpdateApplicationStatus(application._id, 'Rejected')}
                                      className="text-red-600 hover:text-red-900 text-xs font-medium"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => navigate(`/dashboard/messages?user=${application.applicantId?._id}`)}
                                  className="text-blue-600 hover:text-blue-900 text-xs font-medium"
                                >
                                  Chat
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
