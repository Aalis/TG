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
      },
      transitions: {
        easing: {
          easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
          easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
          easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
          sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
        },
        duration: {
          shortest: 150,
          shorter: 200,
          short: 250,
          standard: 300,
          complex: 375,
          enteringScreen: 225,
          leavingScreen: 195,
        },
      },
      components: {
        MuiButtonBase: {
          defaultProps: {
            disableRipple: false,
          },
          styleOverrides: {
            root: {
              transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1)',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              transition: 'box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              transition: 'transform 225ms cubic-bezier(0, 0, 0.2, 1) 0ms !important',
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            },
          },
        },
      },
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