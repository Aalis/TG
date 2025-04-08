import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Container,
  Avatar,
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  BottomNavigation,
  BottomNavigationAction,
  useMediaQuery,
  useTheme as useMuiTheme,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Group as GroupsIcon,
  Forum as ChannelsIcon,
  Person as ProfileIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  ShoppingCart as ShoppingCartIcon,
  History as SessionsIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ParsePermissionCountdown from '../components/ParsePermissionCountdown';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchSessions } from '../hooks/useSessions';
import { SlideTransition } from '../utils/transitions';

const drawerWidth = 240;

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [value, setValue] = useState(location.pathname);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleLogoutClick = () => {
    handleCloseUserMenu();
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    setLogoutDialogOpen(false);
    logout();
    navigate('/login');
  };

  const handleNavigate = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handlePrefetchSessions = () => {
    prefetchSessions(queryClient);
  };

  const handleBottomNavChange = (event, newValue) => {
    setValue(newValue);
    navigate(newValue);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          TG Parser
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        <ListItem 
          button 
          onClick={() => handleNavigate('/groups')}
          selected={location.pathname === '/groups'}
        >
          <ListItemIcon>
            <GroupsIcon />
          </ListItemIcon>
          <ListItemText primary={t('navigation.parsedGroups', 'Groups')} />
        </ListItem>
        <ListItem 
          button 
          onClick={() => handleNavigate('/channels')}
          selected={location.pathname === '/channels'}
        >
          <ListItemIcon>
            <ChannelsIcon />
          </ListItemIcon>
          <ListItemText primary={t('navigation.parsedChannels', 'Channels')} />
        </ListItem>
        <ListItem 
          button 
          onClick={() => handleNavigate('/')}
          selected={location.pathname === '/'}
          onMouseEnter={handlePrefetchSessions}
        >
          <ListItemIcon>
            <SessionsIcon />
          </ListItemIcon>
          <ListItemText primary={t('navigation.sessions', 'Sessions')} />
        </ListItem>
      </List>
      <Divider />
      <List>
        <ListItem 
          button 
          onClick={() => handleNavigate('/subscribe')}
          selected={location.pathname === '/subscribe'}
        >
          <ListItemIcon>
            <ShoppingCartIcon />
          </ListItemIcon>
          <ListItemText primary={t('common.subscribe', 'Subscribe')} />
        </ListItem>
        {user?.is_superuser && (
          <ListItem 
            button 
            onClick={() => handleNavigate('/admin')}
            selected={location.pathname === '/admin'}
          >
            <ListItemIcon>
              <AdminIcon />
            </ListItemIcon>
            <ListItemText primary={t('navigation.admin', 'Admin')} />
          </ListItem>
        )}
        <ListItem 
          button 
          onClick={() => handleNavigate('/profile')}
          selected={location.pathname === '/profile'}
        >
          <ListItemIcon>
            <ProfileIcon />
          </ListItemIcon>
          <ListItemText primary={t('navigation.profile', 'Profile')} />
        </ListItem>
        <ListItem button onClick={handleLogoutClick}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary={t('common.logout', 'Logout')} />
        </ListItem>
      </List>
    </div>
  );

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
        label={t('common.subscribe', 'Subscribe')}
        value="/subscribe"
        icon={<ShoppingCartIcon />}
      />
    </BottomNavigation>
  );

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography 
            variant="h6" 
            noWrap 
            component="div"
            sx={{ 
              display: { xs: 'block', sm: 'block' },
              flexGrow: { xs: 0, sm: 1 },
              mr: { sm: 2 }
            }}
          >
            TG Parser
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            flexGrow: { xs: 1, sm: 0 },
            justifyContent: 'center',
            minHeight: { xs: '40px', sm: '48px' }
          }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              justifyContent: 'center'
            }}>
              {user?.is_active && !user?.can_parse ? (
                <Chip
                  label={t('telegram.demoMode')}
                  color="warning"
                  size="small"
                  sx={{ 
                    height: '24px',
                    '& .MuiChip-label': { 
                      px: 1,
                      fontSize: { xs: '0.75rem', sm: '0.8125rem' }
                    }
                  }}
                />
              ) : user?.parse_permission_expires ? (
                <ParsePermissionCountdown 
                  expiresAt={user.parse_permission_expires} 
                  canParse={user?.can_parse}
                  isDemoMode={false}
                />
              ) : (
                <Chip
                  label={t('telegram.parseDisabled')}
                  color="error"
                  size="small"
                  sx={{ 
                    height: '24px',
                    '& .MuiChip-label': { 
                      px: 1,
                      fontSize: { xs: '0.75rem', sm: '0.8125rem' }
                    }
                  }}
                />
              )}
            </Box>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5,
              flexShrink: 0
            }}>
              <LanguageSwitcher />
              {isMobile ? (
                <IconButton
                  color="inherit"
                  onClick={handleOpenUserMenu}
                  size="small"
                  sx={{ p: { xs: 0.5, sm: 1 } }}
                >
                  <ProfileIcon />
                </IconButton>
              ) : (
                <>
                  <IconButton
                    color="inherit"
                    onClick={toggleTheme}
                    size="small"
                    sx={{ p: { xs: 0.5, sm: 1 } }}
                  >
                    {theme === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                  </IconButton>
                  <Tooltip title={t('common.openSettings', 'Open settings')}>
                    <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                      <Avatar>{user?.email?.[0]?.toUpperCase()}</Avatar>
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          ...(isMobile ? {
            pb: 8, // Add padding for bottom navigation
          } : {
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
          }),
        }}
      >
        <Toolbar />
        {children}
      </Box>

      {isMobile && bottomNav}

      <Menu
        sx={{ mt: '45px' }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        <MenuItem onClick={() => { handleCloseUserMenu(); navigate('/profile'); }}>
          <Typography textAlign="center">{t('navigation.profile', 'Profile')}</Typography>
        </MenuItem>
        <MenuItem onClick={handleLogoutClick}>
          <Typography textAlign="center">{t('common.logout', 'Logout')}</Typography>
        </MenuItem>
      </Menu>

      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        TransitionComponent={SlideTransition}
        PaperProps={{
          elevation: 0,
          sx: {
            bgcolor: isMobile ? 'rgba(33, 33, 33, 0.95)' : 'background.paper',
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
          <Typography variant="h6" sx={{ color: isMobile ? '#fff' : 'text.primary', mb: 1 }}>
            {t('common.confirmLogout', 'Confirm Logout')}
          </Typography>
          
          <Typography sx={{ color: isMobile ? '#fff' : 'text.primary', mb: 2 }}>
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
                color: isMobile ? '#9e9e9e' : 'text.secondary',
                '&:hover': {
                  bgcolor: isMobile ? 'rgba(158, 158, 158, 0.08)' : 'action.hover'
                }
              }}
            >
              {t('common.cancel', 'ОТМЕНА')}
            </Button>
            <Button 
              onClick={handleLogoutConfirm}
              variant={isMobile ? "contained" : "contained"}
              color="primary"
            >
              {t('common.confirm', 'ПОДТВЕРДИТЬ')}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default MainLayout;