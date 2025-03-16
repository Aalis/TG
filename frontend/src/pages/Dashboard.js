import React from 'react';
import {
  Typography,
  Box,
  Grid,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import TelegramSessions from '../components/TelegramSessions';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Привет, {user?.username}!
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

export default Dashboard; 