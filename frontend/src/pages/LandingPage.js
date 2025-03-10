import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          mt: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 4
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to Telegram Group Parser
        </Typography>
        
        <Typography variant="h5" color="text.secondary" paragraph>
          A powerful tool for analyzing Telegram groups and channels.
          Get insights, track activity, and manage your data efficiently.
        </Typography>

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
          >
            Get Started
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/login')}
          >
            Log In
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LandingPage; 