import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

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
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Subscribe from './pages/Subscribe';

// Layouts
import MainLayout from './layouts/MainLayout';
import PublicLayout from './layouts/PublicLayout';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {user ? (
        // Protected routes
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/groups" element={<ParsedGroups />} />
          <Route path="/groups/:id" element={<GroupDetails />} />
          <Route path="/channels" element={<ParsedChannels />} />
          <Route path="/channels/:id" element={<ChannelDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/subscribe" element={<Subscribe />} />
          {user.is_superuser && (
            <Route path="/admin" element={<AdminPanel />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        // Public routes
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default App; 