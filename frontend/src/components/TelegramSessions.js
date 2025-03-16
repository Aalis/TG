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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [needsPassword, setNeedsPassword] = useState(false);

  const steps = [
    t('telegram.enterPhoneNumber'),
    t('telegram.verifyCode'),
    t('common.complete')
  ];

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data } = await sessionsAPI.getAll();
      // Sort sessions by creation date to maintain stable order
      const sortedSessions = data.sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );
      setSessions(sortedSessions);
    } catch (err) {
      setError(t('telegram.failedToFetchSessions'));
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
      setError(t('telegram.phoneNumberRequired'));
      return;
    }

    setLoading(true);
    try {
      const { data } = await sessionsAPI.verifyPhone(phoneNumber);
      setPhoneCodeHash(data.phone_code_hash);
      setActiveStep(1);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || t('telegram.failedToSendVerificationCode'));
      console.error('Error sending code:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError(t('telegram.verificationCodeRequired'));
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
      setSuccess(t('telegram.sessionAddedSuccessfully'));
      handleCloseDialog();
    } catch (err) {
      console.error('Full error object:', err);  // Debug log
      console.error('Error response data:', err.response?.data);  // Debug log
      const errorMessage = err.response?.data?.detail;
      if (errorMessage === 'Two-factor authentication required') {
        setNeedsPassword(true);
        setError(t('telegram.twoFactorAuthRequired'));
      } else {
        setError(errorMessage || t('telegram.failedToVerifyCode'));
      }
      console.error('Error verifying code:', err);
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
      setError(t('telegram.failedToDeleteSession'));
      console.error('Error deleting session:', err);
    }
  };

  const handleToggleStatus = async (sessionId, currentStatus) => {
    try {
      await sessionsAPI.update(sessionId, !currentStatus);
      await fetchSessions();
    } catch (err) {
      setError(t('telegram.failedToUpdateSessionStatus'));
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
        );
      case 1:
        return (
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
              <Button onClick={() => setActiveStep(0)}>{t('common.back')}</Button>
              <Button
                onClick={handleVerifyCode}
                variant="contained"
                color="primary"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : t('telegram.verifyCode')}
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
        <Typography variant="h6">{t('telegram.telegramSessions')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddSession}
        >
          {t('telegram.addSession')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {sessions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {t('telegram.noActiveSessionsFound')}
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddSession}
            sx={{ mt: 1 }}
          >
            {t('telegram.addYourFirstSession')}
          </Button>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('telegram.phone')}</TableCell>
                <TableCell>{t('telegram.createdAt')}</TableCell>
                <TableCell align="center">{t('telegram.status')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {session.phone}
                  </TableCell>
                  <TableCell>
                    {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}
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
                      onClick={() => handleDeleteClick(session)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('telegram.addTelegramSession')}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('telegram.deleteSession')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('telegram.deleteSessionConfirm', { phone: sessionToDelete?.phone })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>{t('common.cancel')}</Button>
          <Button
            onClick={handleDeleteSession}
            color="error"
            variant="contained"
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TelegramSessions; 