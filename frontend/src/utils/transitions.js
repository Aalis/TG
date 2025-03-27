/**
 * Transition utility functions for smooth UI transitions
 */
import { forwardRef } from 'react';
import { Slide, Fade, Zoom, Grow } from '@mui/material';

// Slide transition for dialogs
export const SlideTransition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Fade transition for elements
export const FadeTransition = forwardRef(function Transition(props, ref) {
  return <Fade ref={ref} {...props} />;
});

// Zoom transition for popovers and menus
export const ZoomTransition = forwardRef(function Transition(props, ref) {
  return <Zoom ref={ref} {...props} />;
});

// Grow transition for tooltips
export const GrowTransition = forwardRef(function Transition(props, ref) {
  return <Grow ref={ref} {...props} />;
});

// Common transition durations
export const transitionDurations = {
  shortest: 150,
  shorter: 200, 
  short: 250,
  standard: 300,
  complex: 375,
  enteringScreen: 225,
  leavingScreen: 195
};

// Easing functions for smoother animations
export const easingValues = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
};

// Function to create transition style objects
export const createTransitionStyle = (properties = ['all'], duration = 300, easing = easingValues.easeInOut) => {
  const transitionProperties = Array.isArray(properties) ? properties.join(', ') : properties;
  return {
    transition: `${transitionProperties} ${duration}ms ${easing}`
  };
};

// Animation props for Material-UI components
export const getMuiTransitionProps = (duration = 'standard') => ({
  timeout: typeof duration === 'string' ? transitionDurations[duration] : duration
});

// Dialog transition props
export const dialogTransitionProps = {
  TransitionComponent: SlideTransition,
  TransitionProps: getMuiTransitionProps('enteringScreen')
}; 