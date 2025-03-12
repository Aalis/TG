import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { authService } from '../services/authService';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const token = searchParams.get('token');
  console.log('Reset token from URL:', token); // Debug log

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      enqueueSnackbar('Invalid reset token', { variant: 'error' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      enqueueSnackbar('Passwords do not match', { variant: 'error' });
      return;
    }

    try {
      console.log('Attempting to reset password with token:', token); // Debug log
      await authService.resetPassword(token, formData.password);
      setIsSubmitted(true);
      enqueueSnackbar('Password has been reset successfully', {
        variant: 'success',
      });
    } catch (error) {
      console.error('Reset password error:', error.response?.data); // Debug log
      enqueueSnackbar(error.response?.data?.detail || 'Failed to reset password', {
        variant: 'error',
      });
    }
  };

  if (!token) {
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
          <Alert severity="error" sx={{ mb: 2 }}>
            Invalid Reset Link
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The password reset link is invalid or has expired. Please request a new password reset.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate('/forgot-password')}
          >
            Request New Reset Link
          </Button>
        </Paper>
      </Box>
    );
  }

  if (isSubmitted) {
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
            Password Reset Successful
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Your password has been reset successfully. You can now log in with your new password.
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
          Reset Password
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
          Enter your new password below.
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
            label="New Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
          />
          <TextField
            required
            fullWidth
            size="small"
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 1 }}
          >
            Reset Password
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ResetPassword; 