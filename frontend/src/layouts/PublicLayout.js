import React from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Container,
  Button,
  useTheme as useMuiTheme,
  useMediaQuery
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from '@mui/icons-material';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const PublicLayout = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
      }}
    >
      <AppBar position="fixed">
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {isMobile ? (
              <>
                <Typography
                  variant="h6"
                  noWrap
                  component="div"
                  sx={{ flexGrow: 1 }}
                  onClick={() => navigate('/')}
                  style={{ cursor: 'pointer' }}
                >
                  TG Parser
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton 
                    sx={{ ml: 1 }} 
                    onClick={toggleTheme} 
                    color="inherit"
                  >
                    {theme === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                  </IconButton>
                  <LanguageSwitcher />
                </Box>
              </>
            ) : (
              <>
                <Typography
                  variant="h6"
                  noWrap
                  component="div"
                  onClick={() => navigate('/')}
                  style={{ cursor: 'pointer' }}
                >
                  TG Parser
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 'auto' }}>
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
                    {theme === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                  </IconButton>
                  <LanguageSwitcher />
                </Box>
              </>
            )}
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
        }}
      >
        <Container 
          maxWidth={isMobile ? "xs" : "lg"} 
          sx={{ 
            flexGrow: 1, 
            py: isMobile ? 1.5 : 3,
            px: isMobile ? 2 : 3
          }}
          disableGutters={isMobile}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default PublicLayout; 