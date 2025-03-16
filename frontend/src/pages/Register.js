import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [isRegistered, setIsRegistered] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error for the field being changed
    setErrors({
      ...errors,
      [e.target.name]: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset all errors
    setErrors({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    });
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setErrors({
        ...errors,
        confirmPassword: 'Passwords do not match',
      });
      return;
    }

    try {
      const { confirmPassword, ...registrationData } = formData;
      const success = await register(registrationData.email, registrationData.username, registrationData.password);
      if (success) {
        // Store username for login page
        localStorage.setItem('lastRegisteredUsername', registrationData.username);
        setIsRegistered(true);
        enqueueSnackbar('Registration successful! Please check your email to verify your account.', { 
          variant: 'success',
          autoHideDuration: 8000
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      
      // Handle specific error messages
      if (errorMessage.includes('email already exists')) {
        setErrors({
          ...errors,
          email: 'This email is already registered',
        });
      } else if (errorMessage.includes('username already exists')) {
        setErrors({
          ...errors,
          username: 'This username is already taken',
        });
      } else {
        // General error
        enqueueSnackbar(errorMessage, { variant: 'error' });
      }
    }
  };

  if (isRegistered) {
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
          <Alert severity="success" sx={{ mb: 2 }}>
            Registration successful!
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            A verification email has been sent to {formData.email}. Please check your inbox and click the verification link.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </Button>
        </Paper>
      </Box>
    );
  }

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
          Create Account
        </Typography>
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
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
            error={!!errors.email}
            helperText={errors.email}
          />
          <TextField
            required
            fullWidth
            size="small"
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            error={!!errors.username}
            helperText={errors.username}
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
            autoComplete="new-password"
            error={!!errors.password}
            helperText={errors.password}
          />
          <TextField
            required
            fullWidth
            size="small"
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 1 }}
          >
            Register
          </Button>
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login">
                Sign In
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Register; 