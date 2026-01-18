import axios from 'axios';

// Get API base URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/api/users/profile'),
  updateProfile: (data) => api.put('/api/users/profile', data),
  changePassword: (data) => api.post('/api/users/change-password', data),
};

// Admin API
export const adminAPI = {
  getUsers: (params) => api.get('/api/admin/users', { params }),
  getUserById: (id) => api.get(`/api/admin/users/${id}`),
  approveUser: (id, data) => api.post(`/api/admin/users/${id}/approve`, data),
  rejectUser: (id, data) => api.post(`/api/admin/users/${id}/reject`, data),
  suspendUser: (id, data) => api.post(`/api/admin/users/${id}/suspend`, data),
  unsuspendUser: (id) => api.post(`/api/admin/users/${id}/unsuspend`),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`),
  bulkApprove: (data) => api.post('/api/admin/users/bulk-approve', data),
  getDashboardStats: () => api.get('/api/admin/dashboard/stats'),
};

export default api;
