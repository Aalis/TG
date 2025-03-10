import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Paper,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from 'notistack';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState({
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      enqueueSnackbar('Passwords do not match', { variant: 'error' });
      return;
    }

    try {
      const { confirmPassword, ...registrationData } = formData;
      const success = await register(registrationData.email, registrationData.username, registrationData.password);
      if (success) {
        enqueueSnackbar('Registration successful!', { variant: 'success' });
        navigate('/login');
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.detail || 'Registration failed', { variant: 'error' });
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