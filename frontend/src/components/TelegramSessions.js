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
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { sessionsAPI } from '../services/api';
import { format } from 'date-fns';

const TelegramSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [needsPassword, setNeedsPassword] = useState(false);

  const steps = ['Enter Phone Number', 'Verify Code', 'Complete'];

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
    setActiveStep(0);
    setPhoneNumber('');
    setVerificationCode('');
    setTwoFactorPassword('');
    setPhoneCodeHash('');
    setNeedsPassword(false);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setPhoneNumber('');
    setVerificationCode('');
    setTwoFactorPassword('');
    setPhoneCodeHash('');
    setActiveStep(0);
    setError('');
    setNeedsPassword(false);
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      const { data } = await sessionsAPI.verifyPhone(phoneNumber);
      setPhoneCodeHash(data.phone_code_hash);
      setActiveStep(1);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send verification code');
      console.error('Error sending code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError('Verification code is required');
      return;
    }

    console.log('Sending verification request with data:', {  // Debug log
      phoneNumber,
      verificationCode,
      phoneCodeHash,
      needsPassword,
      twoFactorPassword,
    });

    setLoading(true);
    try {
      await sessionsAPI.verifyCode(
        phoneNumber,
        verificationCode,
        phoneCodeHash,
        needsPassword ? twoFactorPassword : undefined
      );
      await fetchSessions();
      setSuccess('Session added successfully');
      handleCloseDialog();
    } catch (err) {
      console.error('Full error object:', err);  // Debug log
      console.error('Error response data:', err.response?.data);  // Debug log
      const errorMessage = err.response?.data?.detail;
      if (errorMessage === 'Two-factor authentication required') {
        setNeedsPassword(true);
        setError('Please enter your two-factor authentication password');
      } else {
        setError(errorMessage || 'Failed to verify code');
      }
      console.error('Error verifying code:', err);
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

  const renderDialogContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Phone Number"
                type="text"
                fullWidth
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                disabled={loading}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Cancel</Button>
              <Button
                onClick={handleSendCode}
                variant="contained"
                color="primary"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Send Code'}
              </Button>
            </DialogActions>
          </>
        );
      case 1:
        return (
          <>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Verification Code"
                type="text"
                fullWidth
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={loading}
              />
              {needsPassword && (
                <TextField
                  margin="dense"
                  label="Two-Factor Password"
                  type="password"
                  fullWidth
                  value={twoFactorPassword}
                  onChange={(e) => setTwoFactorPassword(e.target.value)}
                  disabled={loading}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setActiveStep(0)}>Back</Button>
              <Button
                onClick={handleVerifyCode}
                variant="contained"
                color="primary"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Verify Code'}
              </Button>
            </DialogActions>
          </>
        );
      default:
        return null;
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
                <TableCell>{session.phone}</TableCell>
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

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add Telegram Session
          <Stepper activeStep={activeStep} sx={{ mt: 2 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </DialogTitle>
        {renderDialogContent()}
      </Dialog>
    </Paper>
  );
};

export default TelegramSessions; 