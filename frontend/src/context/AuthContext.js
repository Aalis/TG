import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

// Create context
const AuthContext = createContext();

// Custom hook to access auth context
export const useAuth = () => useContext(AuthContext);

// Global state outside of React to prevent reinitialization
let globalAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  initialized: false
};

export const AuthProvider = ({ children }) => {
  // Initialize state from global state
  const [user, setUser] = useState(globalAuthState.user);
  const [isAuthenticated, setIsAuthenticated] = useState(globalAuthState.isAuthenticated);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize auth only once, outside of render cycle
  if (!globalAuthState.initialized) {
    globalAuthState.initialized = true;
    
    const token = localStorage.getItem('token');
    if (token) {
      // Set auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Make API call without affecting rendering - we'll update state after
      setTimeout(() => {
        axios.post('/api/v1/login/test-token', null, { timeout: 8000 })
          .then(response => {
            globalAuthState.user = response.data;
            globalAuthState.isAuthenticated = true;
            setUser(response.data);
            setIsAuthenticated(true);
          })
          .catch(() => {
            // Token invalid - clear everything
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
          });
      }, 0);
    }
  }

  // Login function
  const login = async (username, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await axios.post('/api/v1/login/access-token', formData, {
        timeout: 10000
      });
      
      const { access_token } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('token', access_token);
      
      // Set default auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Get user data
      const userResponse = await axios.post('/api/v1/login/test-token', null, {
        timeout: 8000
      });
      
      // Update both local and global state
      const userData = userResponse.data;
      globalAuthState.user = userData;
      globalAuthState.isAuthenticated = true;
      
      setUser(userData);
      setIsAuthenticated(true);
      setIsLoading(false);
      
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      const errorMessage = err.response?.data?.detail || 'Login failed. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      
      return false;
    }
  };

  // Register function
  const register = async (email, username, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await axios.post('/api/v1/users/', {
        email,
        username,
        password
      }, {
        timeout: 10000
      });
      
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Registration failed:', err);
      const errorMessage = err.response?.data?.detail || 'Registration failed. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      throw err;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    
    // Update both local and global state
    globalAuthState.user = null;
    globalAuthState.isAuthenticated = false;
    
    setUser(null);
    setIsAuthenticated(false);
  };

  // Update user profile
  const updateProfile = async (data) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Ensure we have the authorization header set
      const token = localStorage.getItem('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      
      // Make the API call to update the profile
      const response = await axios.put('/api/v1/users/me', data, {
        timeout: 10000
      });
      
      // Update both local and global state
      const userData = response.data;
      globalAuthState.user = userData;
      
      setUser(userData);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error('Profile update error:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to update profile. Please try again.';
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    setError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 