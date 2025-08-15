import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import { 
  getJobs, 
  createJob, 
  applyToJob, 
  saveJob, 
  getJob 
} from '../redux/slices/jobSlice';

const Jobs = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { jobs, loading } = useSelector((state) => state.job);
  
  const [showJobForm, setShowJobForm] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    jobType: '',
    location: '',
    experienceLevel: ''
  });
  
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
    salary: '',
    contactEmail: ''
  });

  const [applicationData, setApplicationData] = useState({
    coverLetter: '',
    resume: null
  });

  useEffect(() => {
    dispatch(getJobs(filters));
  }, [dispatch, filters]);

  const handleCreateJob = async (e) => {
    e.preventDefault();
    
    try {
      const jobData = {
        ...jobFormData,
        skills: jobFormData.skills.split(',').map(skill => skill.trim()).filter(Boolean)
      };

      await dispatch(createJob(jobData)).unwrap();
      setShowJobForm(false);
      setJobFormData({
        title: '', company: '', location: '', description: '', requirements: '',
        responsibilities: '', skills: '', jobType: 'full-time', experienceLevel: 'entry',
        salary: '', contactEmail: ''
      });
      toast.success('Job posted successfully!');
    } catch (error) {
      toast.error(error || 'Failed to post job');
    }
  };

  const handleApplyToJob = async (e) => {
    e.preventDefault();
    
    if (!applicationData.coverLetter.trim()) {
      toast.error('Please write a cover letter');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('coverLetter', applicationData.coverLetter.trim());
      if (applicationData.resume) {
        formData.append('resume', applicationData.resume);
      }

      console.log('Submitting job application:', {
        jobId: selectedJob._id,
        coverLetter: applicationData.coverLetter.trim(),
        hasResume: !!applicationData.resume
      });

      await dispatch(applyToJob({
        jobId: selectedJob._id,
        applicationData: formData
      })).unwrap();
      
      setShowApplicationForm(false);
      setApplicationData({ coverLetter: '', resume: null });
      toast.success('🎉 Applied Successfully! Your application has been submitted.');
      
      // Refresh jobs to update application status
      dispatch(getJobs(filters));
    } catch (error) {
      console.error('Job application error:', error);
      // Show more specific error messages
      if (error.includes('already applied')) {
        toast.error('You have already applied for this job');
      } else if (error.includes('Cover letter is required')) {
        toast.error('Please write a cover letter');
      } else if (error.includes('Invalid application data')) {
        toast.error('Please check your application data and try again');
      } else {
        toast.error(error || 'Failed to submit application');
      }
    }
  };

  const handleSaveJob = async (jobId) => {
    try {
      const result = await dispatch(saveJob(jobId)).unwrap();
      if (result.saved) {
        toast.success('Job saved successfully!');
      } else {
        toast.success('Job removed from saved jobs');
      }
      // Refresh user data to update savedJobs array
      dispatch({ type: 'auth/updateUser', payload: { ...user, savedJobs: result.saved ? [...(user.savedJobs || []), jobId] : (user.savedJobs || []).filter(id => id !== jobId) } });
    } catch (error) {
      toast.error('Failed to save job');
    }
  };

  const hasAppliedToJob = (job) => {
    return job.applications && job.applications.some(app => 
      app.userId === user._id
    );
  };

  const getApplicationStatus = (job) => {
    if (!job.applications) return null;
    const application = job.applications.find(app => app.userId === user._id);
    return application ? application.status : null;
  };

  const renderApplyButton = (job) => {
    if (job.postedBy === user._id) {
      return (
        <span className="text-gray-500 text-sm">Your job posting</span>
      );
    }

    if (hasAppliedToJob(job)) {
      const status = getApplicationStatus(job);
      return (
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${
          status === 'Approved' ? 'bg-green-100 text-green-800' :
          status === 'Rejected' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {status}
        </span>
      );
    }

    return (
      <button
        onClick={() => {
          setSelectedJob(job);
          setShowApplicationForm(true);
        }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
      >
        Apply Now
      </button>
    );
  };

  const handleJobSelect = (job) => {
    setSelectedJob(job);
    dispatch(getJob(job._id));
  };

  const filteredJobs = (Array.isArray(jobs) ? jobs : []).filter(job => {
    const matchesSearch = job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilters = (!filters.jobType || job.jobType === filters.jobType) &&
                          (!filters.location || job.location?.toLowerCase().includes(filters.location.toLowerCase())) &&
                          (!filters.experienceLevel || job.experienceLevel === filters.experienceLevel);
    
    return matchesSearch && matchesFilters;
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Please log in to view jobs</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Job Opportunities</h1>
            <p className="text-gray-600">Discover your next career move</p>
          </div>
          {user.role === 'admin' && (
            <button
              onClick={() => setShowJobForm(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Post New Job</span>
              </div>
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Search & Filter Jobs</h3>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              />
              <svg className="absolute right-3 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={filters.jobType}
              onChange={(e) => setFilters({...filters, jobType: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
            >
              <option value="">All Job Types</option>
              <option value="full-time">Full Time</option>
              <option value="part-time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
            <input
              type="text"
              placeholder="Location"
              value={filters.location}
              onChange={(e) => setFilters({...filters, location: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
            />
            <select
              value={filters.experienceLevel}
              onChange={(e) => setFilters({...filters, experienceLevel: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
            >
              <option value="">All Experience Levels</option>
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior Level</option>
              <option value="executive">Executive</option>
            </select>
          </div>
        </div>

        {/* Jobs Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(Array.isArray(filteredJobs) ? filteredJobs : []).map((job) => (
            <div key={job._id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900 leading-tight">{job.title}</h3>
                <button
                  onClick={() => handleSaveJob(job._id)}
                  className={`transition-colors duration-200 p-1 ${
                    user.savedJobs && user.savedJobs.includes(job._id) 
                      ? 'text-yellow-500' 
                      : 'text-gray-400 hover:text-yellow-500'
                  }`}
                  title={user.savedJobs && user.savedJobs.includes(job._id) ? 'Remove from saved' : 'Save Job'}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </button>
              </div>
              
              <div className="flex items-center space-x-2 mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-gray-700 font-medium">{job.company}</p>
              </div>
              
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-600">{job.location}</p>
              </div>
              
              <p className="text-gray-700 mb-4 line-clamp-3 leading-relaxed">{job.description}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {job.skills && job.skills.slice(0, 3).map((skill, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                    {skill}
                  </span>
                ))}
                {job.skills && job.skills.length > 3 && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                    +{job.skills.length - 3} more
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center mb-6">
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                  {job.jobType}
                </span>
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">
                  {job.experienceLevel}
                </span>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => handleJobSelect(job)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
                >
                  View Details
                </button>
                {renderApplyButton(job)}
              </div>
            </div>
          ))}
        </div>

        {filteredJobs.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No jobs found matching your criteria</p>
          </div>
        )}

        {/* Job Creation Modal */}
        {showJobForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Post New Job</h2>
              <form onSubmit={handleCreateJob}>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Job Title"
                    value={jobFormData.title}
                    onChange={(e) => setJobFormData({...jobFormData, title: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Company"
                    value={jobFormData.company}
                    onChange={(e) => setJobFormData({...jobFormData, company: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={jobFormData.location}
                    onChange={(e) => setJobFormData({...jobFormData, location: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Contact Email"
                    value={jobFormData.contactEmail}
                    onChange={(e) => setJobFormData({...jobFormData, contactEmail: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    required
                  />
                  <select
                    value={jobFormData.jobType}
                    onChange={(e) => setJobFormData({...jobFormData, jobType: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                  <select
                    value={jobFormData.experienceLevel}
                    onChange={(e) => setJobFormData({...jobFormData, experienceLevel: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                
                <textarea
                  placeholder="Job Description"
                  value={jobFormData.description}
                  onChange={(e) => setJobFormData({...jobFormData, description: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 mt-4"
                  rows="4"
                  required
                />
                
                <textarea
                  placeholder="Requirements (one per line)"
                  value={jobFormData.requirements}
                  onChange={(e) => setJobFormData({...jobFormData, requirements: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 mt-4"
                  rows="3"
                />
                
                <textarea
                  placeholder="Responsibilities (one per line)"
                  value={jobFormData.responsibilities}
                  onChange={(e) => setJobFormData({...jobFormData, responsibilities: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 mt-4"
                  rows="3"
                />
                
                <input
                  type="text"
                  placeholder="Skills (comma separated)"
                  value={jobFormData.skills}
                  onChange={(e) => setJobFormData({...jobFormData, skills: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 mt-4"
                />
                
                <input
                  type="text"
                  placeholder="Salary (optional)"
                  value={jobFormData.salary}
                  onChange={(e) => setJobFormData({...jobFormData, salary: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 mt-4"
                />
                
                <div className="flex space-x-3 mt-6">
                  <button type="submit" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg flex-1">
                    Post Job
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJobForm(false)}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Application Modal */}
        {showApplicationForm && selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h2 className="text-2xl font-bold mb-4">Apply for {selectedJob.title}</h2>
              <form onSubmit={handleApplyToJob}>
                <textarea
                  placeholder="Cover Letter"
                  value={applicationData.coverLetter}
                  onChange={(e) => setApplicationData({...applicationData, coverLetter: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  rows="6"
                  required
                />
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resume (optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setApplicationData({...applicationData, resume: e.target.files[0]})}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: PDF, DOC, DOCX (Max 5MB)
                  </p>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button type="submit" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg flex-1">
                    Submit Application
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApplicationForm(false)}
                    className="bg-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-300 transition-all duration-200 font-medium flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Jobs;
