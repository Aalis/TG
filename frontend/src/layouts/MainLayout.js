import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  ChevronLeft as ChevronLeftIcon,
  Group as GroupsIcon,
  Forum as ChannelsIcon,
  Person as ProfileIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  ShoppingCart as ShoppingCartIcon,
  AccountCircle as AccountCircleIcon,
  History as SessionsIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ParsePermissionCountdown from '../components/ParsePermissionCountdown';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const drawerWidth = 240;

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

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
          <ListItemText primary={t('navigation.parsedGroups')} />
        </ListItem>
        <ListItem 
          button 
          onClick={() => handleNavigate('/channels')}
          selected={location.pathname === '/channels'}
        >
          <ListItemIcon>
            <ChannelsIcon />
          </ListItemIcon>
          <ListItemText primary={t('navigation.parsedChannels')} />
        </ListItem>
        <ListItem 
          button 
          onClick={() => handleNavigate('/')}
          selected={location.pathname === '/'}
        >
          <ListItemIcon>
            <SessionsIcon />
          </ListItemIcon>
          <ListItemText primary={t('navigation.sessions')} />
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
          <ListItemText primary={t('common.subscribe')} />
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
            <ListItemText primary={t('navigation.admin')} />
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
          <ListItemText primary={t('navigation.profile')} />
        </ListItem>
        <ListItem button onClick={handleLogoutClick}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary={t('common.logout')} />
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              {t('common.welcome')}
            </Typography>
            
            <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center' }}>
              <ParsePermissionCountdown 
                expiresAt={user?.parse_permission_expires} 
                canParse={user?.can_parse}
              />
              <IconButton sx={{ ml: 1 }} onClick={toggleTheme} color="inherit">
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
              <Tooltip title={user?.email || ''}>
                <IconButton onClick={handleOpenUserMenu} sx={{ p: 0, ml: 1 }}>
                  <Avatar alt={user?.username} src="/static/images/avatar/2.jpg" />
                </IconButton>
              </Tooltip>
              <LanguageSwitcher />
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
                  <Typography textAlign="center">{t('navigation.profile')}</Typography>
                </MenuItem>
                <MenuItem onClick={handleLogoutClick}>
                  <Typography textAlign="center">{t('common.logout')}</Typography>
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
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
      </Box>
      
      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        aria-labelledby="logout-dialog-title"
      >
        <DialogTitle id="logout-dialog-title">
          {t('auth.confirmLogout', 'Confirm Logout')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('auth.logoutConfirmMessage', 'Are you sure you want to log out? You will need to sign in again to access your account.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleLogoutConfirm} color="error" variant="contained">
            {t('common.logout')}
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px'
        }}
      >
        <Container maxWidth="lg">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};

export default MainLayout; 