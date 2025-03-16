import React, { useState, useEffect } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import {
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Grid,
  Avatar,
  CircularProgress,
  Alert,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  InputAdornment,
  IconButton,
  Snackbar,
} from '@mui/material';
import { 
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

// Validation schema
const ProfileSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .required('Username is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match'),
});

const Profile = () => {
  const { user, updateProfile, error, setError, isLoading } = useAuth();
  const [success, setSuccess] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState(null);
  const [formActions, setFormActions] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [initialValues, setInitialValues] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  // Update initial values when user data is available
  useEffect(() => {
    if (user) {
      setInitialValues({
        email: user.email || '',
        username: user.username || '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [user]);

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = (values, actions) => {
    // Store form values and actions for use after confirmation
    setFormValues(values);
    setFormActions(actions);
    setConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    // Close the dialog
    setConfirmDialogOpen(false);
    
    if (!formValues || !formActions) return;
    
    // Only include password if it's provided
    const updateData = {
      email: formValues.email,
      username: formValues.username,
    };
    
    if (formValues.password) {
      updateData.password = formValues.password;
    }
    
    try {
      const result = await updateProfile(updateData);
      
      if (result) {
        setSuccess(true);
        
        // Reset password fields
        formActions.setFieldValue('password', '');
        formActions.setFieldValue('confirmPassword', '');
        
        // Update initial values with new data (except password)
        setInitialValues(prev => ({
          ...prev,
          email: formValues.email,
          username: formValues.username,
          password: '',
          confirmPassword: '',
        }));
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
    } finally {
      formActions.setSubmitting(false);
      
      // Clear form state
      setFormValues(null);
      setFormActions(null);
    }
  };

  const handleCancelSubmit = () => {
    setConfirmDialogOpen(false);
    
    if (formActions) {
      formActions.setSubmitting(false);
    }
    
    // Clear form state
    setFormValues(null);
    setFormActions(null);
  };

  const handleCloseSuccessAlert = () => {
    setSuccess(false);
  };

  const handleCloseErrorAlert = () => {
    setError(null);
  };

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Profile
      </Typography>
      
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ width: 80, height: 80, mr: 3, bgcolor: 'primary.main' }}>
            <PersonIcon sx={{ fontSize: 40 }} />
          </Avatar>
          
          <Box>
            <Typography variant="h5">
              {user.username}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        <Snackbar 
          open={error !== null} 
          autoHideDuration={6000} 
          onClose={handleCloseErrorAlert}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseErrorAlert} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
        
        <Snackbar 
          open={success} 
          autoHideDuration={3000} 
          onClose={handleCloseSuccessAlert}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSuccessAlert} severity="success" sx={{ width: '100%' }}>
            Profile updated successfully!
          </Alert>
        </Snackbar>
        
        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={ProfileSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, isSubmitting, dirty, resetForm }) => (
            <Form>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="email"
                    label="Email"
                    fullWidth
                    margin="normal"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="username"
                    label="Username"
                    fullWidth
                    margin="normal"
                    error={touched.username && Boolean(errors.username)}
                    helperText={touched.username && errors.username}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                    Change Password
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Leave blank if you don't want to change your password.
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="password"
                    label="New Password"
                    type={showPassword ? "text" : "password"}
                    fullWidth
                    margin="normal"
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleTogglePasswordVisibility}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="confirmPassword"
                    label="Confirm New Password"
                    type={showConfirmPassword ? "text" : "password"}
                    fullWidth
                    margin="normal"
                    error={touched.confirmPassword && Boolean(errors.confirmPassword)}
                    helperText={touched.confirmPassword && errors.confirmPassword}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle confirm password visibility"
                            onClick={handleToggleConfirmPasswordVisibility}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  type="button"
                  variant="outlined"
                  color="secondary"
                  onClick={() => resetForm()}
                  disabled={!dirty || isSubmitting}
                >
                  Reset
                </Button>
                
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting || isLoading || !dirty}
                  startIcon={isSubmitting || isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
                >
                  Save Changes
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCancelSubmit}
        aria-labelledby="confirm-profile-update-dialog"
      >
        <DialogTitle id="confirm-profile-update-dialog">
          Confirm Profile Update
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to save these changes to your profile?
            {formValues?.password && (
              <strong> This will also change your password.</strong>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelSubmit} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmSubmit} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile; 