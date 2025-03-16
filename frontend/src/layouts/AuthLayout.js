import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Container, Paper, Box, Typography, IconButton } from '@mui/material';
import { Brightness4 as DarkModeIcon, Brightness7 as LightModeIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const AuthLayout = () => {
  const { isAuthenticated } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const { t } = useTranslation();

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
          <IconButton onClick={toggleTheme} color="primary">
            {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <LanguageSwitcher />
        </Box>
        
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2,
            width: '100%',
          }}
        >
          <Typography component="h1" variant="h4" sx={{ mb: 3 }}>
            {t('common.welcome')}
          </Typography>
          
          <Outlet />
        </Paper>
      </Box>
    </Container>
  );
};

export default AuthLayout; 