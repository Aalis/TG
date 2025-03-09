import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import {
  TextField,
  Button,
  Typography,
  Link,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

// Validation schema
const LoginSchema = Yup.object().shape({
  username: Yup.string().required('Username is required'),
  password: Yup.string().required('Password is required'),
});

const Login = () => {
  const { login, error, setError, isLoading } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (values, { setSubmitting }) => {
    const success = await login(values.username, values.password);
    
    if (success) {
      navigate('/');
    }
    
    setSubmitting(false);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Formik
        initialValues={{ username: '', password: '' }}
        validationSchema={LoginSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form>
            <Field
              as={TextField}
              name="username"
              label="Username"
              fullWidth
              variant="outlined"
              margin="dense"
              sx={{ mb: 2 }}
              error={touched.username && Boolean(errors.username)}
              helperText={touched.username && errors.username}
              disabled={isLoading || isSubmitting}
              autoComplete="username"
            />
            
            <Field
              as={TextField}
              name="password"
              label="Password"
              type="password"
              fullWidth
              variant="outlined"
              margin="dense"
              sx={{ mb: 2 }}
              error={touched.password && Boolean(errors.password)}
              helperText={touched.password && errors.password}
              disabled={isLoading || isSubmitting}
              autoComplete="current-password"
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              disabled={isLoading || isSubmitting}
              sx={{ mt: 1, mb: 2 }}
            >
              {(isLoading || isSubmitting) ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2">
                Don't have an account?{' '}
                <Link component={RouterLink} to="/register" variant="body2">
                  Sign Up
                </Link>
              </Typography>
            </Box>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default Login; 