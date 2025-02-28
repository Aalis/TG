import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // Set default auth header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verify token validity
          const response = await axios.post('/api/v1/login/test-token');
          
          setUser(response.data);
          setIsAuthenticated(true);
        } catch (err) {
          // Token is invalid or expired
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setError('Session expired. Please login again.');
        }
      }
      
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  // Login function
  const login = async (username, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await axios.post('/api/v1/login/access-token', formData);
      
      const { access_token } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('token', access_token);
      
      // Set default auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Get user data
      const userResponse = await axios.post('/api/v1/login/test-token');
      
      setUser(userResponse.data);
      setIsAuthenticated(true);
      setIsLoading(false);
      
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
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
      });
      
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
      setIsLoading(false);
      return false;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
  };

  // Update user profile
  const updateProfile = async (data) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.put('/api/v1/users/me', data);
      
      setUser(response.data);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile. Please try again.');
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