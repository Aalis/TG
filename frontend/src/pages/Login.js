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
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    // Clear error when typing
    if (formError) {
      setFormError('');
    }
    
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Don't submit if already submitting
    if (isSubmitting) return;
    
    // Basic validation
    if (!formData.username.trim() || !formData.password.trim()) {
      setFormError('Username and password are required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const success = await login(formData.username, formData.password);
      if (success) {
        // Reset form data
        setFormData({
          username: '',
          password: '',
        });
        navigate('/', { replace: true });
      } else {
        setFormError(authError || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setFormError('Login failed. Please try again.');
      enqueueSnackbar('Login failed. Please try again.', { variant: 'error' });
    } finally {
      setIsSubmitting(false);
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
          {t('auth.loginTitle', 'Sign In')}
        </Typography>
        
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
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
          noValidate
        >
          <TextField
            required
            fullWidth
            size="small"
            label={t('common.username', 'Username')}
            name="username"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            disabled={isSubmitting}
            error={!!formError}
            inputProps={{ 
              autoCapitalize: "none",
              spellCheck: "false"
            }}
          />
          <TextField
            required
            fullWidth
            size="small"
            label={t('common.password', 'Password')}
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="current-password"
            disabled={isSubmitting}
            error={!!formError}
          />
          <Box sx={{ width: '100%', textAlign: 'right' }}>
            <Link
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              sx={{ textDecoration: 'none' }}
            >
              {t('auth.forgotPassword', 'Forgot Password?')}
            </Link>
          </Box>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 1, position: 'relative' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <CircularProgress size={24} sx={{ 
                  position: 'absolute',
                  left: '10%',
                  color: 'inherit'
                }} />
                {t('common.signingIn', 'Signing in...')}
              </>
            ) : t('auth.signIn', 'Sign In')}
          </Button>
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('auth.noAccount', "Don't have an account?")}{' '}
              <Link component={RouterLink} to="/register">
                {t('common.register', 'Register')}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login; 