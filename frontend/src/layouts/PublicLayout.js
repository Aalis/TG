import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Container,
  Button,
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from '@mui/icons-material';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const PublicLayout = () => {
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        bgcolor: darkMode ? 'background.default' : 'background.default',
        transition: 'none', // Disable transition on initial render
      }}
      className="public-layout"
    >
      <AppBar 
        position="fixed"
        sx={{
          backgroundColor: darkMode ? '#272727' : 'primary.main',
          transition: 'none', // Disable transition on initial render
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 1 }}
              onClick={() => navigate('/')}
              style={{ cursor: 'pointer' }}
            >
              {t('common.welcome')}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                color="inherit"
                onClick={() => navigate('/register')}
              >
                {t('common.register')}
              </Button>
              <Button
                color="inherit"
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  '&:hover': {
                    borderColor: 'white'
                  }
                }}
              >
                {t('common.login')}
              </Button>
              <IconButton 
                sx={{ ml: 1 }} 
                onClick={toggleTheme} 
                color="inherit"
              >
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <LanguageSwitcher />
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '64px',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: darkMode ? 'background.default' : 'background.default',
        }}
      >
        <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};

// Add an effect to restore transitions after initial render
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const layoutElements = document.querySelectorAll('.public-layout, .public-layout .MuiAppBar-root');
      layoutElements.forEach(el => {
        if (el && el.style) {
          el.style.transition = '';
        }
      });
    }, 300);
  });
}

export default PublicLayout; 