import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';

// No need for this function as we now handle preloading in index.html
// const addThemePreloadingStyles = () => {...};
// addThemePreloadingStyles();

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Initialize with the proper theme from localStorage to prevent flicker
  const [darkMode, setDarkMode] = useState(() => {
    // This needs to match the logic in the preloading script
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Effect to handle system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const userTheme = localStorage.getItem('theme');
      if (!userTheme) {
        setDarkMode(e.matches);
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } 
    // Legacy browsers (Safari)
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Cleanup any preloading styling elements
  useEffect(() => {
    // Remove any preloading styles after the theme is fully initialized
    const preloadStyles = document.getElementById('theme-preload-styles');
    if (preloadStyles) {
      preloadStyles.remove();
    }
    
    // Also ensure the root is visible
    const root = document.getElementById('root');
    if (root) {
      root.style.visibility = 'visible';
    }
    
    // Clean up the forceful styles too
    const forceStyle = document.getElementById('theme-preload-forceful');
    if (forceStyle) {
      setTimeout(() => forceStyle.remove(), 100);
    }
  }, []);

  // Toggle theme function
  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    // Sync the html attribute for any CSS that uses it
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: '#2196f3',
          },
          secondary: {
            main: '#f50057',
          },
          background: {
            default: darkMode ? '#121212' : '#f5f5f5',
            paper: darkMode ? '#1e1e1e' : '#ffffff',
          },
        },
        typography: {
          fontFamily: [
            'Roboto',
            'Arial',
            'sans-serif',
          ].join(','),
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: darkMode 
                  ? '0 4px 20px rgba(0, 0, 0, 0.5)'
                  : '0 4px 20px rgba(0, 0, 0, 0.1)',
              },
            },
          },
          CssBaseline: {
            styleOverrides: {
              body: {
                transition: 'background-color 0.2s ease, color 0.2s ease',
                backgroundColor: darkMode ? '#121212' : '#f5f5f5',
              },
              // Ensure global styles have the correct background
              '@global': {
                html: {
                  backgroundColor: darkMode ? '#121212' : '#f5f5f5',
                }
              }
            },
          },
        },
      }),
    [darkMode]
  );

  const value = {
    darkMode,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}; 