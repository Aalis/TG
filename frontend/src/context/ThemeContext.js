import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';

// No need for this function as we now handle preloading in index.html
// const addThemePreloadingStyles = () => {...};
// addThemePreloadingStyles();

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Get theme from document element to avoid initialization race conditions
  const [theme, setTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'light'
  );
  
  // Toggle theme function with direct DOM manipulation
  const toggleTheme = useCallback(() => {
    setTheme(currentTheme => {
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      // Update localStorage and HTML element
      localStorage.setItem('theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      
      return newTheme;
    });
  }, []);

  // Create MUI theme object
  const muiTheme = useMemo(() => 
    createTheme({
      palette: {
        mode: theme === 'dark' ? 'dark' : 'light',
        primary: {
          main: '#2196f3',
        },
        secondary: {
          main: '#f50057',
        },
        background: {
          default: theme === 'dark' ? '#121212' : '#f5f5f5',
          paper: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        },
      }
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MuiThemeProvider theme={muiTheme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}; 