import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { SnackbarProvider } from 'notistack';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import TelegramTokens from './pages/TelegramTokens';
import ParsedGroups from './pages/ParsedGroups';
import ParsedChannels from './pages/ParsedChannels';
import GroupDetails from './pages/GroupDetails';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import ChannelDetails from './pages/ChannelDetails';
import AdminPanel from './pages/AdminPanel';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }
  
  if (!isAuthenticated) {
    // Save the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

// Admin Route Component
const AdminRoute = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user?.is_superuser) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }
  
  return (
    <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
      <div className={`app ${theme}`}>
        <CssBaseline />
        <Routes>
          {/* Public Routes */}
          <Route element={<AuthLayout />}>
            <Route path="login" element={
              isAuthenticated ? 
                <Navigate to={location.state?.from?.pathname || "/"} replace /> : 
                <Login />
            } />
            <Route path="register" element={
              isAuthenticated ? 
                <Navigate to={location.state?.from?.pathname || "/"} replace /> : 
                <Register />
            } />
          </Route>
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="tokens" element={<TelegramTokens />} />
            <Route path="groups" element={<ParsedGroups />} />
            <Route path="groups/:id" element={<GroupDetails />} />
            <Route path="channels" element={<ParsedChannels />} />
            <Route path="channels/:id" element={<ChannelDetails />} />
            <Route path="profile" element={<Profile />} />
            
            {/* Admin Routes */}
            <Route path="admin" element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            } />
          </Route>
          
          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </SnackbarProvider>
  );
}

export default App; 