import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/axios';

export const createJob = createAsyncThunk(
  'job/createJob',
  async (jobData, { rejectWithValue }) => {
    try {
      const response = await api.post('/jobs', jobData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create job');
    }
  }
);

export const getJobs = createAsyncThunk(
  'job/getJobs',
  async (filters, { rejectWithValue }) => {
    try {
      const response = await api.get('/jobs', { params: filters });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch jobs');
    }
  }
);

export const getJob = createAsyncThunk(
  'job/getJob',
  async (jobId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch job');
    }
  }
);

export const applyToJob = createAsyncThunk(
  'job/applyToJob',
  async ({ jobId, applicationData }, { rejectWithValue }) => {
    try {
      // Let axios set the correct multipart boundary; Authorization is added by interceptor
      const response = await api.post(`/jobs/${jobId}/apply`, applicationData);
      return { jobId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to apply to job');
    }
  }
);

export const saveJob = createAsyncThunk(
  'job/saveJob',
  async (jobId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/jobs/${jobId}/save`);
      return { jobId, saved: response.data.saved };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to save job');
    }
  }
);

export const getSavedJobs = createAsyncThunk(
  'job/getSavedJobs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/jobs/saved');
      return response.data.savedJobs;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch saved jobs');
    }
  }
);

export const searchJobs = createAsyncThunk(
  'job/searchJobs',
  async (searchParams, { rejectWithValue }) => {
    try {
      const response = await api.get('/jobs/search', { params: searchParams });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Job search failed');
    }
  }
);

// Admin functionality
export const getJobsAdmin = createAsyncThunk(
  'job/getJobsAdmin',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/admin/jobs');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch jobs');
    }
  }
);

export const deleteJob = createAsyncThunk(
  'job/deleteJob',
  async (jobId, { rejectWithValue }) => {
    try {
      await api.delete(`/admin/jobs/${jobId}`);
      return jobId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete job');
    }
  }
);

export const getJobApplications = createAsyncThunk(
  'job/getJobApplications',
  async (jobId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/jobs/${jobId}/applications`);
      return { jobId, applications: response.data.applications };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch job applications');
    }
  }
);

export const updateApplicationStatus = createAsyncThunk(
  'job/updateApplicationStatus',
  async ({ jobId, applicationId, status }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/jobs/${jobId}/applications/${applicationId}/status`, { status });
      return { jobId, applicationId, status, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update application status');
    }
  }
);

const initialState = {
  jobs: [],
  savedJobs: [],
  appliedJobs: [],
  currentJob: null,
  searchResults: [],
  loading: false,
  error: null
};

const jobSlice = createSlice({
  name: 'job',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
    },
    setCurrentJob: (state, action) => {
      state.currentJob = action.payload;
    },
    clearCurrentJob: (state) => {
      state.currentJob = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createJob.fulfilled, (state, action) => {
        state.loading = false;
        const created = action.payload?.job || action.payload;
        if (!Array.isArray(state.jobs)) {
          state.jobs = [];
        }
        state.jobs = [created, ...state.jobs];
      })
      .addCase(createJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getJob.fulfilled, (state, action) => {
        state.currentJob = action.payload;
      })
      .addCase(applyToJob.fulfilled, (state, action) => {
        const { jobId } = action.payload;
        const job = state.jobs.find(j => j._id === jobId);
        if (job) {
          job.hasApplied = true;
        }
      })
      .addCase(saveJob.fulfilled, (state, action) => {
        const { jobId, saved } = action.payload;
        if (saved) {
          state.savedJobs.push(jobId);
        } else {
          state.savedJobs = state.savedJobs.filter(id => id !== jobId);
        }
      })
      .addCase(getSavedJobs.fulfilled, (state, action) => {
        state.savedJobs = action.payload;
      })
      .addCase(searchJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.searchResults = action.payload;
      })
      .addCase(searchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Admin functionality
      .addCase(getJobsAdmin.fulfilled, (state, action) => {
        const payload = action.payload;
        state.jobs = Array.isArray(payload?.jobs) ? payload.jobs : (Array.isArray(payload) ? payload : []);
      })
      .addCase(deleteJob.fulfilled, (state, action) => {
        const jobId = action.payload;
        state.jobs = state.jobs.filter(job => job._id !== jobId);
      })
      .addCase(getJobApplications.fulfilled, (state, action) => {
        const { jobId, applications } = action.payload;
        const job = state.jobs.find(j => j._id === jobId);
        if (job) {
          job.applications = applications;
        }
      })
      .addCase(updateApplicationStatus.fulfilled, (state, action) => {
        const { jobId, applicationId, status } = action.payload;
        const job = state.jobs.find(j => j._id === jobId);
        if (job && job.applications) {
          const application = job.applications.find(app => app._id === applicationId);
          if (application) {
            application.status = status;
            application.updatedAt = new Date().toISOString();
          }
        }
      });
  }
});

export const {
  clearError,
  clearSearchResults,
  setCurrentJob,
  clearCurrentJob
} = jobSlice.actions;

export default jobSlice.reducer;
