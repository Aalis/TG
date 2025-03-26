import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import './i18n';

// Ensure theme is applied before first render
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const savedTheme = localStorage.getItem('theme');
const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', initialTheme);

// Mount the app
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode causes double rendering in development, removing for stability
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

// Enable transitions after load to prevent flickering
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.documentElement.classList.add('transitions-enabled');
  }, 1000);
}); 