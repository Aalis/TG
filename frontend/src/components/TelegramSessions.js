import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  IconButton,
  Box,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { sessionsAPI } from '../services/api';
import { format } from 'date-fns';

const TelegramSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data } = await sessionsAPI.getAll();
      setSessions(data);
    } catch (err) {
      setError('Failed to fetch sessions');
      console.error('Error fetching sessions:', err);
    }
  };

  const handleAddSession = () => {
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setPhoneNumber('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      await sessionsAPI.create(phoneNumber);
      await fetchSessions();
      setSuccess('Session added successfully');
      handleCloseDialog();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add session');
      console.error('Error adding session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await sessionsAPI.delete(sessionId);
      await fetchSessions();
      setSuccess('Session deleted successfully');
    } catch (err) {
      setError('Failed to delete session');
      console.error('Error deleting session:', err);
    }
  };

  const handleToggleStatus = async (sessionId, currentStatus) => {
    try {
      await sessionsAPI.update(sessionId, !currentStatus);
      await fetchSessions();
      setSuccess('Session status updated successfully');
    } catch (err) {
      setError('Failed to update session status');
      console.error('Error updating session status:', err);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Telegram Sessions</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddSession}
        >
          Add Session
        </Button>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Phone Number</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell>Updated At</TableCell>
              <TableCell align="center">Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>{session.phone_number}</TableCell>
                <TableCell>
                  {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  {format(new Date(session.updated_at), 'MMM d, yyyy HH:mm')}
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={session.is_active}
                    onChange={() => handleToggleStatus(session.id, session.is_active)}
                    color="primary"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteSession(session.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No sessions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Add New Session</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Phone Number"
            type="tel"
            fullWidth
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            error={!!error}
            helperText={error}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            color="primary"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TelegramSessions; 