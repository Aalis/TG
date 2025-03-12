import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Paper,
  Alert,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from 'notistack';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  // Check for verification status and stored username
  useEffect(() => {
    const isVerified = searchParams.get('verified') === 'true';
    const storedUsername = localStorage.getItem('lastRegisteredUsername');
    
    if (isVerified) {
      enqueueSnackbar('Email verified successfully! Please log in.', { 
        variant: 'success',
        autoHideDuration: 6000
      });
    }
    
    if (storedUsername) {
      setFormData(prev => ({
        ...prev,
        username: storedUsername
      }));
      localStorage.removeItem('lastRegisteredUsername'); // Clean up
    }
  }, [searchParams, enqueueSnackbar]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const success = await login(formData.username, formData.password);
      if (success) {
        navigate('/');
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.detail || 'Login failed', { variant: 'error' });
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 3,
          width: '100%',
          maxWidth: '400px',
          borderRadius: 2,
        }}
      >
        <Typography variant="h5" align="center" gutterBottom>
          Sign In
        </Typography>
        {searchParams.get('verified') === 'true' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Email verified successfully! Please log in.
          </Alert>
        )}
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <TextField
            required
            fullWidth
            size="small"
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
          />
          <TextField
            required
            fullWidth
            size="small"
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
          <Box sx={{ width: '100%', textAlign: 'right' }}>
            <Link
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              sx={{ textDecoration: 'none' }}
            >
              Forgot password?
            </Link>
          </Box>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 1 }}
          >
            Sign In
          </Button>
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Link component={RouterLink} to="/register">
                Register
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login; 