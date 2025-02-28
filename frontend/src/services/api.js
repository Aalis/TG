import axios from 'axios';

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
  getAll: () => api.get('/telegram/tokens/'),
  create: (tokenData) => api.post('/telegram/tokens/', tokenData),
  update: (id, tokenData) => api.put(`/telegram/tokens/${id}`, tokenData),
  delete: (id) => api.delete(`/telegram/tokens/${id}`),
};

// Telegram Groups API
export const groupsAPI = {
  getAll: () => api.get('/telegram/groups/'),
  getById: (id) => api.get(`/telegram/groups/${id}`),
  delete: (id) => api.delete(`/telegram/groups/${id}`),
  parseGroup: (groupLink) => api.post('/telegram/parse-group/', { group_link: groupLink }),
};

export default api; 