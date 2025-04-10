import React, { useEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  Container,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Button,
} from '@mui/material';
import {
  Home as HomeIcon,
  Group as GroupsIcon,
  Forum as ChannelsIcon,
  Person as PersonIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import TelegramSessions from '../components/TelegramSessions';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchSessions, SESSIONS_QUERY_KEY } from '../hooks/useSessions';
import { useNavigate, useLocation } from 'react-router-dom';

const Sessions = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const isRussian = i18n.language === 'ru';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  // Force language refresh on component mount
  useEffect(() => {
    const currentLang = localStorage.getItem('i18nextLng') || 'en';
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
  }, [i18n]);

  // Prefetch sessions data when component mounts
  useEffect(() => {
    // Check if sessions data is already in cache
    const sessionsData = queryClient.getQueryData(SESSIONS_QUERY_KEY);
    
    // Only prefetch if data isn't already in cache
    if (!sessionsData) {
      prefetchSessions(queryClient);
    }
  }, [queryClient]);

  const handleBottomNavChange = (event, newValue) => {
    navigate(newValue);
  };

  const bottomNav = (
    <BottomNavigation
      value={location.pathname}
      onChange={handleBottomNavChange}
      showLabels
      sx={{
        width: '100%',
        position: 'fixed',
        bottom: 0,
        borderTop: 1,
        borderColor: 'divider',
        zIndex: (theme) => theme.zIndex.appBar,
        bgcolor: 'background.paper',
      }}
    >
      <BottomNavigationAction
        label={t('navigation.sessions', 'Sessions')}
        value="/"
        icon={<HomeIcon />}
      />
      <BottomNavigationAction
        label={t('navigation.parsedGroups', 'Groups')}
        value="/groups"
        icon={<GroupsIcon />}
      />
      <BottomNavigationAction
        label={t('navigation.parsedChannels', 'Channels')}
        value="/channels"
        icon={<ChannelsIcon />}
      />
      <BottomNavigationAction
        label={t('navigation.profile', 'Profile')}
        value="/profile"
        icon={<PersonIcon />}
      />
    </BottomNavigation>
  );

  return (
    <Container 
      maxWidth={isMobile ? "xs" : "lg"} 
      sx={{ 
        pb: isMobile ? 8 : 3, 
        px: isMobile ? 0 : 3 
      }}
      disableGutters={isMobile}
    >
      <Box>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3,
          backgroundColor: 'background.default',
          py: 1,
          px: isMobile ? 2 : 0
        }}>
          <Typography 
            variant={isMobile ? "h4" : "h4"} 
            component="h1"
            sx={{ 
              fontWeight: 500
            }}
          >
            {t('navigation.sessions', 'Sessions')}
          </Typography>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => document.dispatchEvent(new CustomEvent('add-telegram-session'))}
            sx={{
              textTransform: 'uppercase',
              mb: 0
            }}
          >
            {t('common.add', 'ADD')}
          </Button>
        </Box>
        
        <Paper sx={{ 
          p: isMobile ? 2 : 3, 
          mb: 3,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          mx: 0
        }}>
          <TelegramSessions />
        </Paper>
      </Box>
      {isMobile && bottomNav}
    </Container>
  );
};

export default Sessions; 