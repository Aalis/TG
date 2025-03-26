import React, { useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import TelegramSessions from '../components/TelegramSessions';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchSessions, SESSIONS_QUERY_KEY } from '../hooks/useSessions';

const Sessions = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const isRussian = i18n.language === 'ru';

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

  // Text localization
  const greeting = isRussian ? "Привет" : "Hello";

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {greeting}, {user?.username}!
      </Typography>
      
      <Grid container spacing={3}>
        {/* Telegram Sessions */}
        <Grid item xs={12}>
          <TelegramSessions />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Sessions; 