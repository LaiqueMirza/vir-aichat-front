import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Agent API
export const agentAPI = {
  // Get all agents
  getAll: () => api.get('/agents'),
  
  // Get agent by ID
  getById: (id) => api.get(`/agents/${id}`),
  
  // Create new agent
  create: (agentData) => api.post('/agents', agentData),
  
  // Update agent
  update: (id, agentData) => api.put(`/agents/${id}`, agentData),
  
  // Delete agent
  delete: (id) => api.delete(`/agents/${id}`),
  
  // Upload files for agent (updated to match backend)
  uploadFiles: (id, files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    return api.post(`/files/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// Chat API
export const chatAPI = {
  // Get chat history (updated to match backend)
  getHistory: (agentId, clientId = null) => {
    const url = clientId 
      ? `/chat/${agentId}?clientId=${clientId}`
      : `/chat/${agentId}`;
    return api.get(url);
  },
  
  // Send message (updated to match backend)
  sendMessage: (agentId, message, clientId = null) => 
    api.post(`/chat/${agentId}/message`, { message, clientId }),
  
  // Get chat by ID
  getChat: (chatId) => api.get(`/chat/session/${chatId}`),
  
  // Delete chat
  deleteChat: (chatId) => api.delete(`/chat/session/${chatId}`),
  
  // Get recent chats across all agents (for admin dashboard)
  getRecentChats: (limit = 10) => api.get(`/chat/recent?limit=${limit}`)
};

// Lead API
export const leadAPI = {
  // Get all leads across all agents (for admin dashboard)
  getAll: (status = null, limit = 50, offset = 0) => {
    const params = new URLSearchParams({ limit, offset });
    if (status) params.append('status', status);
    return api.get(`/leads/all?${params}`);
  },
  
  // Get leads by agent (updated to match backend)
  getByAgent: (agentId, status = null) => {
    const url = status 
      ? `/leads/${agentId}?status=${status}`
      : `/leads/${agentId}`;
    return api.get(url);
  },
  
  // Get lead by ID
  getById: (id) => api.get(`/leads/${id}`),
  
  // Create lead
  create: (agentId, leadData) => api.post(`/leads/${agentId}`, leadData),
  
  // Update lead
  update: (id, leadData) => api.put(`/leads/${id}`, leadData),
  
  // Delete lead
  delete: (id) => api.delete(`/leads/${id}`),
  
  // Get lead statistics
  getStats: (agentId) => api.get(`/leads/${agentId}/stats`)
};

// File API
export const fileAPI = {
  // Get files for agent (updated to match backend)
  getAgentFiles: (agentId) => api.get(`/files/${agentId}`),
  
  // Delete file
  delete: (fileId) => api.delete(`/files/${fileId}`)
};

// Analytics API
export const analyticsAPI = {
  // Get dashboard stats (matches backend endpoint)
  getDashboardStats: (period = '30d') => api.get(`/analytics/dashboard?period=${period}`),
  
  // Get per-agent analytics (matches backend endpoint)
  getAgentAnalytics: (agentId, period = '30d') => api.get(`/analytics/${agentId}?period=${period}`),
  
  // Get cost breakdown (matches backend endpoint)
  getCostBreakdown: (agentId, period = '30d') => api.get(`/analytics/${agentId}/costs?period=${period}`),
  
  // Get user engagement metrics (matches backend endpoint)
  getUserEngagement: (agentId, period = '30d') => api.get(`/analytics/${agentId}/engagement?period=${period}`),
  
  // Get performance metrics (matches backend endpoint)
  getPerformanceMetrics: (agentId, period = '30d') => api.get(`/analytics/${agentId}/performance?period=${period}`),
  
  // Alias for backward compatibility
  getUsageStats: (period = '30d') => api.get(`/analytics/dashboard?period=${period}`)
};

// Health check
export const healthAPI = {
  check: () => api.get('/health'),
  detailed: () => api.get('/health/detailed')
};

// Utility functions
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.message || error.response.data?.error || 'An error occurred';
    return {
      message,
      status: error.response.status,
      data: error.response.data
    };
  } else if (error.request) {
    // Request made but no response received
    return {
      message: 'Network error - please check your connection',
      status: 0,
      data: null
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'An unexpected error occurred',
      status: 0,
      data: null
    };
  }
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format currency
export const formatCurrency = (amount) => {
  // Handle null, undefined, NaN, or non-numeric values
  if (amount == null || isNaN(amount) || typeof amount !== 'number') {
    return '$0.0000';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4
  }).format(amount);
};

// Format number with commas
export const formatNumber = (num) => {
  // Handle null, undefined, NaN, or non-numeric values
  if (num == null || isNaN(num) || typeof num !== 'number') {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(num);
};

export default api;