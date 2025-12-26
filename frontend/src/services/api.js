import axios from 'axios';

// Use relative path to go through nginx proxy, or fallback to environment variable
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  checkSetup: () => api.get('/auth/check-setup'),
  setup: (username, password) => api.post('/auth/setup', { username, password }),
  login: (username, password) => api.post('/auth/login', { username, password }),
  changePassword: (currentPassword, newPassword) => 
    api.put('/auth/change-password', { currentPassword, newPassword }),
  getCurrentUser: () => api.get('/auth/me'),
};

export const accountsAPI = {
  getAll: () => api.get('/accounts'),
  add: (username) => api.post('/accounts', { username }),
  getDetails: (username) => api.get(`/accounts/${username}`),
  getStats: (username, days = 30) => api.get(`/accounts/${username}/stats?days=${days}`),
  getRecentChanges: (username, type, limit = 10) => 
    api.get(`/accounts/${username}/recent-changes?type=${type}&limit=${limit}`),
  getRecentActivity: (username, limit = 10) => 
    api.get(`/accounts/${username}/recent-activity?limit=${limit}`),
  getHistory: (username, page = 1, limit = 50, eventType = null) => {
    const params = new URLSearchParams({ page, limit });
    if (eventType) params.append('eventType', eventType);
    return api.get(`/accounts/${username}/history?${params}`);
  },
  getRemovedFollowers: (username) => api.get(`/accounts/${username}/removed-followers`),
  getRemovedFollowing: (username) => api.get(`/accounts/${username}/removed-following`),
  delete: (username) => api.delete(`/accounts/${username}`),
};

export const exportAPI = {
  getFollowersCSV: (username) => 
    `${API_BASE_URL}/export/${username}/followers`,
  getFollowingCSV: (username) => 
    `${API_BASE_URL}/export/${username}/following`,
  getMutualCSV: (username) => 
    `${API_BASE_URL}/export/${username}/mutual`,
  getAllCSV: (username) => 
    `${API_BASE_URL}/export/${username}/all`,
};

export const auditAPI = {
  getAll: (page = 1, limit = 50, eventType = null, trackedAccountUsername = null) => {
    const params = new URLSearchParams({ page, limit });
    if (eventType) params.append('eventType', eventType);
    if (trackedAccountUsername) params.append('trackedAccountUsername', trackedAccountUsername);
    return api.get(`/audit?${params}`);
  },
  getByAccount: (username, page = 1, limit = 50) => 
    api.get(`/audit/account/${username}?page=${page}&limit=${limit}`),
  getScraping: (limit = 20) => api.get(`/audit/scraping?limit=${limit}`),
};

export const configAPI = {
  get: () => api.get('/config'),
  updateScrapingInterval: (intervalMinutes) => 
    api.put('/config/scraping-interval', { intervalMinutes }),
};

export default api;