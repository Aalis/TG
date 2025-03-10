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

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

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