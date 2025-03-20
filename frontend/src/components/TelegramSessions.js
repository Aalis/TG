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
  Tooltip,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { sessionsAPI } from '../services/api';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const TelegramSessions = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [needsPassword, setNeedsPassword] = useState(false);

  const steps = [
    t('telegram.enterPhoneNumber'),
    t('telegram.verifyCode'),
    t('common.complete')
  ];

  // Remove redundant language refresh
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await sessionsAPI.getAll();
      // Add debug logging
      console.log('Sessions response:', response.data);
      
      // Sort sessions by creation date to maintain stable order
      const sortedSessions = response.data.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );
      console.log('Sorted sessions:', sortedSessions);
      setSessions(sortedSessions || []);
      setError('');
    } catch (err) {
      console.error('Error fetching sessions:', err);
      // Only set error if it's not a 401 (unauthorized) error
      if (!err.response || err.response.status !== 401) {
        setError(t('telegram.failedToFetchSessions'));
      }
    } finally {
      setLoading(false);
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
      setError(t('telegram.phoneNumberRequired'));
      return;
    }

    try {
      setError('');
      const response = await sessionsAPI.verifyPhone(phoneNumber);
      if (response.data && response.data.phone_code_hash) {
        setPhoneCodeHash(response.data.phone_code_hash);
        setActiveStep(1);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error sending code:', err);
      setError(err.response?.data?.detail || t('telegram.failedToSendVerificationCode'));
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError(t('telegram.verificationCodeRequired'));
      return;
    }

    setLoading(true);
    try {
      await sessionsAPI.verifyCode(
        phoneNumber,
        verificationCode,
        phoneCodeHash,
        needsPassword ? twoFactorPassword : undefined
      );
      await fetchSessions();
      setSuccess(t('telegram.sessionAddedSuccessfully'));
      handleCloseDialog();
    } catch (err) {
      console.error('Error verifying code:', err);
      const errorMessage = err.response?.data?.detail;
      if (errorMessage === 'Two-factor authentication required') {
        setNeedsPassword(true);
        setError(t('telegram.twoFactorAuthRequired'));
      } else {
        setError(errorMessage || t('telegram.failedToVerifyCode'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (session) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setSessionToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleDeleteSession = async () => {
    try {
      await sessionsAPI.delete(sessionToDelete.id);
      await fetchSessions();
      setSuccess(t('telegram.sessionDeletedSuccessfully'));
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(t('telegram.failedToDeleteSession'));
    }
  };

  const handleToggleStatus = async (sessionId, currentStatus) => {
    try {
      await sessionsAPI.update(sessionId, !currentStatus);
      await fetchSessions();
    } catch (err) {
      console.error('Error updating session status:', err);
      setError(t('telegram.failedToUpdateSessionStatus'));
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    console.log('Formatting phone number:', phone);
    return phone || '-'; // Return dash if phone is null/undefined
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>
          {t('telegram.telegramSessions')}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddSession}
          sx={{ 
            textTransform: 'none',
            borderRadius: 2,
            px: 3
          }}
        >
          {t('telegram.addSession')}
        </Button>
      </Box>

      {error && !loading && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            '& .MuiAlert-message': { width: '100%' }
          }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 3,
            '& .MuiAlert-message': { width: '100%' }
          }}
        >
          {success}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : sessions.length === 0 ? (
        <Paper 
          sx={{ 
            p: 4, 
            textAlign: 'center', 
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: (theme) => theme.shadows[2]
          }}
        >
          <Typography variant="h6" gutterBottom>
            {t('telegram.noSessionsFound')}
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {t('telegram.addSessionToStart')}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddSession}
            sx={{ 
              textTransform: 'none',
              borderRadius: 2,
              px: 3
            }}
          >
            {t('telegram.addFirstSession')}
          </Button>
        </Paper>
      ) : (
        <TableContainer 
          component={Paper}
          sx={{ 
            borderRadius: 2,
            boxShadow: (theme) => theme.shadows[2]
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 500 }}>
                  {t('telegram.phoneNumber')}
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>
                  {t('telegram.createdAt')}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 500 }}>
                  {t('telegram.status')}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 500 }}>
                  {t('common.actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((session) => (
                <TableRow 
                  key={session.id}
                  sx={{ 
                    '&:hover': { 
                      bgcolor: 'action.hover' 
                    }
                  }}
                >
                  <TableCell sx={{ color: session.is_active ? 'text.primary' : 'text.secondary', minWidth: 150 }}>
                    {session.phone ? session.phone : '-'}
                  </TableCell>
                  <TableCell sx={{ color: session.is_active ? 'text.primary' : 'text.secondary' }}>
                    {format(new Date(session.created_at), 'dd.MM.yyyy HH:mm')}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={session.is_active}
                      onChange={() => handleToggleStatus(session.id, session.is_active)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('actions.delete')}>
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteClick(session)}
                        size="small"
                        sx={{ 
                          '&:hover': { 
                            bgcolor: 'error.lighter'
                          }
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Session Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('telegram.addNewSession')}
        </DialogTitle>
        <Box sx={{ width: '100%', px: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mx: 3, mt: 2 }}>
            {error}
          </Alert>
        )}
        {activeStep === 0 ? (
          <>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label={t('telegram.phoneNumber')}
                type="text"
                fullWidth
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                disabled={loading}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
              <Button
                onClick={handleSendCode}
                variant="contained"
                color="primary"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : t('telegram.sendCode')}
              </Button>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label={t('telegram.verificationCode')}
                type="text"
                fullWidth
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                disabled={loading}
              />
              {needsPassword && (
                <TextField
                  margin="dense"
                  label={t('telegram.twoFactorPassword')}
                  type="password"
                  fullWidth
                  value={twoFactorPassword}
                  onChange={(e) => setTwoFactorPassword(e.target.value)}
                  disabled={loading}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
              <Button
                onClick={handleVerifyCode}
                variant="contained"
                color="primary"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : t('telegram.verify')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>{t('actions.confirm')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('telegram.deleteSessionConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteSession} color="error" variant="contained">
            {t('actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TelegramSessions; 