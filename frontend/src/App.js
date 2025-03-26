import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline } from '@mui/material';
import { useAuth } from './context/AuthContext';
import DataPrefetcher from './components/DataPrefetcherNew';
import { SnackbarProvider } from 'notistack';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ParsedGroups from './pages/ParsedGroups';
import ParsedChannels from './pages/ParsedChannels';
import GroupDetails from './pages/GroupDetails';
import ChannelDetails from './pages/ChannelDetails';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import Sessions from './pages/Sessions';
import LandingPage from './pages/LandingPage';
import Subscribe from './pages/Subscribe';
// eslint-disable-next-line no-unused-vars
import NotFound from './pages/NotFound';

// Layouts
import MainLayout from './layouts/MainLayout';
import PublicLayout from './layouts/PublicLayout';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Main App component with routes
function App() {
  const { isAuthenticated, user } = useAuth();
  
  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider maxSnack={3}>
        <CssBaseline />
        {isAuthenticated && <DataPrefetcher />}
        
        {isAuthenticated ? (
          <MainLayout>
            <Routes>
              <Route path="/" element={<Sessions />} />
              <Route path="/groups" element={<ParsedGroups />} />
              <Route path="/groups/:id" element={<GroupDetails />} />
              <Route path="/channels" element={<ParsedChannels />} />
              <Route path="/channels/:id" element={<ChannelDetails />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/subscribe" element={<Subscribe />} />
              {user?.is_superuser && (
                <Route path="/admin" element={<AdminPanel />} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        ) : (
          <PublicLayout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PublicLayout>
        )}
      </SnackbarProvider>
    </QueryClientProvider>
  );
}

export default App; 