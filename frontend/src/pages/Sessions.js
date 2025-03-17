import React, { useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import TelegramSessions from '../components/TelegramSessions';
import { useTranslation } from 'react-i18next';

const Sessions = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  // Force language refresh on component mount
  useEffect(() => {
    const currentLang = localStorage.getItem('i18nextLng') || 'en';
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
  }, [i18n]);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('common.hello')}, {user?.username}!
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