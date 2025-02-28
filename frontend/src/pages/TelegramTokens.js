import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { tokensAPI } from '../services/api';

// Validation schema for token form
const TokenSchema = Yup.object().shape({
  api_id: Yup.string().required('API ID is required'),
  api_hash: Yup.string().required('API Hash is required'),
  phone: Yup.string(),
  bot_token: Yup.string(),
});

const TelegramTokens = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState(null);

  // Fetch tokens on component mount
  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const response = await tokensAPI.getAll();
      setTokens(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load tokens. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (token = null) => {
    setEditingToken(token);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingToken(null);
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      if (editingToken) {
        // Update existing token
        await tokensAPI.update(editingToken.id, values);
      } else {
        // Create new token
        await tokensAPI.create(values);
      }
      
      // Refresh tokens list
      await fetchTokens();
      
      // Close dialog and reset form
      handleCloseDialog();
      resetForm();
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save token. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (token) => {
    setTokenToDelete(token);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await tokensAPI.delete(tokenToDelete.id);
      
      // Refresh tokens list
      await fetchTokens();
      
      // Close dialog
      setDeleteConfirmOpen(false);
      setTokenToDelete(null);
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete token. Please try again.');
    }
  };

  if (loading && tokens.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Telegram Tokens
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Token
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {tokens.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No Telegram Tokens Found
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            You need to add your Telegram API credentials to start parsing groups.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Your First Token
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {tokens.map((token) => (
            <Grid item xs={12} md={6} key={token.id}>
              <Card className="card-hover">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    API ID: {token.api_id}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    API Hash: {token.api_hash.substring(0, 8)}...
                  </Typography>
                  
                  {token.phone && (
                    <Typography variant="body2" gutterBottom>
                      Phone: {token.phone}
                    </Typography>
                  )}
                  
                  {token.bot_token && (
                    <Typography variant="body2" gutterBottom>
                      Bot Token: {token.bot_token.substring(0, 8)}...
                    </Typography>
                  )}
                  
                  <Typography variant="caption" color="text.secondary" display="block">
                    Created: {new Date(token.created_at).toLocaleString()}
                  </Typography>
                </CardContent>
                
                <CardActions>
                  <Tooltip title="Edit">
                    <IconButton color="primary" onClick={() => handleOpenDialog(token)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Delete">
                    <IconButton color="error" onClick={() => handleDeleteClick(token)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Add/Edit Token Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingToken ? 'Edit Telegram Token' : 'Add Telegram Token'}
        </DialogTitle>
        
        <Formik
          initialValues={{
            api_id: editingToken?.api_id || '',
            api_hash: editingToken?.api_hash || '',
            phone: editingToken?.phone || '',
            bot_token: editingToken?.bot_token || '',
          }}
          validationSchema={TokenSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form>
              <DialogContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Enter your Telegram API credentials. You can get these from{' '}
                  <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">
                    https://my.telegram.org/apps
                  </a>
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="api_id"
                      label="API ID"
                      fullWidth
                      margin="normal"
                      error={touched.api_id && Boolean(errors.api_id)}
                      helperText={touched.api_id && errors.api_id}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="api_hash"
                      label="API Hash"
                      fullWidth
                      margin="normal"
                      error={touched.api_hash && Boolean(errors.api_hash)}
                      helperText={touched.api_hash && errors.api_hash}
                    />
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="body2" color="text.secondary" paragraph>
                  Optional: Enter either a phone number for user account or a bot token.
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="phone"
                      label="Phone Number (optional)"
                      fullWidth
                      margin="normal"
                      error={touched.phone && Boolean(errors.phone)}
                      helperText={touched.phone && errors.phone}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Field
                      as={TextField}
                      name="bot_token"
                      label="Bot Token (optional)"
                      fullWidth
                      margin="normal"
                      error={touched.bot_token && Boolean(errors.bot_token)}
                      helperText={touched.bot_token && errors.bot_token}
                    />
                  </Grid>
                </Grid>
              </DialogContent>
              
              <DialogActions>
                <Button onClick={handleCloseDialog}>Cancel</Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
                >
                  {editingToken ? 'Update' : 'Add'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this Telegram token? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TelegramTokens; 