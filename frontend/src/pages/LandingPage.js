import React from 'react';
import { Box, Typography, Button, Container, useTheme, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Container maxWidth="md" disableGutters={isMobile} sx={{ px: isMobile ? 2 : 3 }}>
      <Box
        sx={{
          mt: isMobile ? 3 : 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: isMobile ? 2 : 4
        }}
      >
        <Typography 
          variant={isMobile ? "h3" : "h2"} 
          component="h1" 
          gutterBottom
          sx={{ 
            fontSize: isMobile ? '2rem' : undefined,
            lineHeight: isMobile ? 1.2 : undefined,
            mb: isMobile ? 1 : 2
          }}
        >
          {t('common.welcome')}
        </Typography>
        
        <Typography 
          variant="h5" 
          color="text.secondary" 
          paragraph
          sx={{ 
            fontSize: isMobile ? '1rem' : undefined,
            mb: isMobile ? 2 : 3
          }}
        >
          {t('landing.description')}
        </Typography>

        <Box sx={{ 
          mt: isMobile ? 2 : 4, 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          width: isMobile ? '100%' : 'auto',
          gap: 2 
        }}>
          <Button
            variant="contained"
            size="large"
            fullWidth={isMobile}
            onClick={() => navigate('/register')}
          >
            {t('auth.signUp')}
          </Button>
          <Button
            variant="outlined"
            size="large"
            fullWidth={isMobile}
            onClick={() => navigate('/login')}
          >
            {t('auth.signIn')}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LandingPage; 