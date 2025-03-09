import axios from 'axios';
import { API_URL } from '../config';

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/api/v1',
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/login/access-token', formData);
  },
  register: (userData) => api.post('/users/', userData),
  getCurrentUser: () => api.get('/users/me'),
  updateProfile: (userData) => api.put('/users/me', userData),
};

// Telegram Tokens API
export const tokensAPI = {
  getAll: () => axios.get(`${API_URL}/telegram/tokens/`),
  create: (tokenData) => axios.post(`${API_URL}/telegram/tokens/`, tokenData),
  update: (id, tokenData) => axios.put(`${API_URL}/telegram/tokens/${id}`, tokenData),
  delete: (id) => axios.delete(`${API_URL}/telegram/tokens/${id}`),
};

// Telegram Groups API
export const groupsAPI = {
  getAll: () => axios.get(`${API_URL}/telegram/parsed-groups/`),
  getById: (id) => axios.get(`${API_URL}/telegram/parsed-groups/${id}`),
  delete: (id) => axios.delete(`${API_URL}/telegram/parsed-groups/${id}`),
  parseGroup: (groupLink, scanComments = false, commentLimit = 100) => 
    axios.post(`${API_URL}/telegram/parse-group/`, {
      group_link: groupLink,
      scan_comments: scanComments,
      comment_limit: commentLimit
    }),
  getParsingProgress: () => axios.get(`${API_URL}/telegram/parse-group/progress`),
  getDialogs: () => axios.get(`${API_URL}/telegram/dialogs/`),
  cancelParsing: () => axios.post(`${API_URL}/telegram/parse-group/cancel`),
};

// Telegram Channels API
export const channelsAPI = {
  getAll: () => axios.get(`${API_URL}/telegram/parsed-channels/`),
  getById: (id) => axios.get(`${API_URL}/telegram/parsed-channels/${id}`),
  deleteChannel: (id) => axios.delete(`${API_URL}/telegram/parsed-channels/${id}`),
  parseChannel: (channelLink, postLimit = 100) => 
    axios.post(`${API_URL}/telegram/parse-channel/`, {
      channel_link: channelLink,
      post_limit: postLimit
    }),
  getPosts: (channelId) => axios.get(`${API_URL}/telegram/groups/${channelId}/posts/`),
  getComments: (postId) => axios.get(`${API_URL}/telegram/posts/${postId}/comments/`),
  getParsingProgress: () => axios.get(`${API_URL}/telegram/parse-channel/progress`),
  getDialogs: () => axios.get(`${API_URL}/telegram/dialogs/`),
  cancelParsing: () => axios.post(`${API_URL}/telegram/parse-channel/cancel`),
};

// Telegram Sessions API
export const sessionsAPI = {
  getAll: () => api.get('/telegram-sessions/'),
  create: (phoneNumber) => api.post('/telegram-sessions/', { phone_number: phoneNumber }),
  update: (id, isActive) => api.patch(`/telegram-sessions/${id}`, { is_active: isActive }),
  delete: (id) => api.delete(`/telegram-sessions/${id}`),
  verifyPhone: (phoneNumber) => api.post('/telegram-sessions/verify-phone/', { phone_number: phoneNumber }),
  verifyCode: (phoneNumber, code, phoneCodeHash, password) => api.post('/telegram-sessions/verify-code/', {
    phone_number: phoneNumber,
    code,
    phone_code_hash: phoneCodeHash,
    password,
  }),
};

export default api; 