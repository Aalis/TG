import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  Container,
  useTheme,
  useMediaQuery,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Logout as LogoutIcon,
  Home as HomeIcon,
  Group as GroupsIcon,
  Forum as ChannelsIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { SlideTransition } from '../utils/transitions';

const Profile = () => {
  const { user, updateProfile, error, setError, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        username: user.username || '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [user]);

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError(t('validation.passwordsMustMatch'));
      return;
    }

    const updateData = {
      email: formData.email,
      username: formData.username,
    };

    if (formData.password) {
      updateData.password = formData.password;
    }

    try {
      const result = await updateProfile(updateData);
      if (result) {
        setSuccess(true);
        setFormData({
          ...formData,
          password: '',
          confirmPassword: '',
        });
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
    }
  };

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    logout();
    navigate('/login');
  };

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

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pb: isMobile ? 8 : 3 }}>
      <Box>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3,
          backgroundColor: 'background.default',
          py: 1
        }}>
          <Typography 
            variant={isMobile ? "h5" : "h4"} 
            component="h1"
            sx={{ 
              fontWeight: 500
            }}
          >
            {t('profile.title', 'Profile')}
          </Typography>

          {isMobile && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              size="small"
              sx={{
                minWidth: 'auto',
                px: 2,
                fontSize: '0.875rem',
                '& .MuiButton-startIcon': {
                  mr: 0.5,
                },
              }}
            >
              {t('common.logout', 'Logout')}
            </Button>
          )}
        </Box>
        
        <Paper sx={{ p: isMobile ? 2 : 3, mb: 3 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              {t('common.email')}
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              value={formData.email}
              onChange={handleChange('email')}
              sx={{ mb: 3 }}
            />

            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
              {t('common.username')}
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              value={formData.username}
              onChange={handleChange('username')}
              sx={{ mb: 3 }}
            />

            <Typography variant="h6" gutterBottom>
              {t('profile.changePassword')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('profile.leaveBlankIfNoChange')}
            </Typography>

            <TextField
              fullWidth
              variant="outlined"
              type={showPassword ? "text" : "password"}
              label={t('profile.newPassword')}
              value={formData.password}
              onChange={handleChange('password')}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              variant="outlined"
              type={showConfirmPassword ? "text" : "password"}
              label={t('profile.confirmNewPassword')}
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleToggleConfirmPasswordVisibility}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ 
            display: 'flex', 
            gap: 2,
            justifyContent: 'flex-end'
          }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setFormData({
                ...formData,
                password: '',
                confirmPassword: '',
              })}
            >
              {t('common.reset')}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <CircularProgress size={24} />
              ) : (
                t('profile.saveChanges')
              )}
            </Button>
          </Box>
        </Paper>
      </Box>

      <Snackbar
        open={error !== null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccess(false)} severity="success">
          {t('profile.updateSuccess')}
        </Alert>
      </Snackbar>

      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        TransitionComponent={SlideTransition}
        PaperProps={{
          elevation: 0,
          sx: {
            bgcolor: 'rgba(33, 33, 33, 0.95)',
            borderRadius: 2,
            width: '90%',
            maxWidth: '400px'
          }
        }}
        sx={{
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(2px)',
            transition: 'backdrop-filter 225ms cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }
        }}
      >
        <DialogContent sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          p: 3,
          gap: 2
        }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
            {t('common.confirmLogout', 'Confirm Logout')}
          </Typography>
          
          <Typography sx={{ color: '#fff', mb: 2 }}>
            {t('common.logoutMessage', 'Are you sure you want to logout?')}
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            gap: 2,
            '& .MuiButton-root': {
              flex: 1,
              py: 1,
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'uppercase'
            }
          }}>
            <Button 
              onClick={() => setLogoutDialogOpen(false)}
              sx={{ 
                color: '#9e9e9e',
                '&:hover': {
                  bgcolor: 'rgba(158, 158, 158, 0.08)'
                }
              }}
            >
              {t('common.cancel', 'ОТМЕНА')}
            </Button>
            <Button 
              onClick={handleLogoutConfirm}
              sx={{ 
                bgcolor: '#2196f3',
                color: '#fff',
                '&:hover': {
                  bgcolor: '#1976d2'
                }
              }}
            >
              {t('common.confirm', 'ПОДТВЕРДИТЬ')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
      {isMobile && bottomNav}
    </Container>
  );
};

export default Profile; 