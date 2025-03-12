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
import { useSnackbar } from 'notistack';
import { authService } from '../services/authService';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await authService.forgotPassword(email);
      setIsSubmitted(true);
      enqueueSnackbar('If the email exists, password reset instructions will be sent.', {
        variant: 'success',
      });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to process request', {
        variant: 'error',
      });
    }
  };

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
            Check your email
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            If an account exists with the email {email}, you will receive password reset instructions.
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate('/login')}
          >
            Return to Login
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
          Forgot Password
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
          Enter your email address and we'll send you instructions to reset your password.
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
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 1 }}
          >
            Send Reset Instructions
          </Button>
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Remember your password?{' '}
              <Link component={RouterLink} to="/login">
                Sign in
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ForgotPassword; 