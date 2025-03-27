import React, { useState, useEffect, useCallback } from 'react';
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
import { useSessions } from '../hooks/useSessions';
import { useSnackbar } from 'notistack';
import { SlideTransition } from '../utils/transitions';

const TelegramSessions = () => {
  const { t, i18n } = useTranslation();
  const isRussian = i18n.language === 'ru';
  
  // Use React Query hook instead of manual state and fetching
  const {
    sessions,
    isLoading,
    isError,
    error: queryError,
    toggleSession,
    deleteSession,
    sendVerificationCode,
    verifyCode,
    isDeleting,
    isToggling,
    isSendingCode,
    isVerifying
  } = useSessions();
  
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [needsPassword, setNeedsPassword] = useState(false);

  // Text content based on language
  const texts = {
    // Page header
    pageTitle: isRussian ? "Сессии Telegram" : "Telegram Sessions",
    addNewSession: isRussian ? "Добавить новую сессию" : "Add New Session",
    
    // Table headers
    phoneNumber: isRussian ? "Номер телефона" : "Phone Number",
    createdAt: isRussian ? "Создано" : "Created At",
    lastUsed: isRussian ? "Последнее использование" : "Last Used",
    active: isRussian ? "Активно" : "Active",
    actions: isRussian ? "Действия" : "Actions",
    
    // Empty state
    noSessionsFound: isRussian ? "Сессии не найдены" : "No Sessions Found",
    addYourFirstSession: isRussian ? "Добавьте вашу первую сессию Telegram, чтобы начать работу с TG Parser" : "Add your first Telegram session to start working with TG Parser",
    addSession: isRussian ? "Добавить сессию" : "Add Session",
    
    // Dialog
    addTelegramSession: isRussian ? "Добавить сессию Telegram" : "Add Telegram Session",
    enterPhoneNumber: isRussian ? "Введите номер телефона" : "Enter Phone Number",
    verifyCode: isRussian ? "Подтвердить код" : "Verify Code",
    complete: isRussian ? "Завершено" : "Complete",
    enterPhoneNumberWithCountryCode: isRussian ? "Введите номер телефона с кодом страны" : "Enter your phone number with country code",
    phoneNumberPlaceholder: "+1234567890",
    phoneNumberHelperText: isRussian ? "Включите код страны (например, +7 для России)" : "Include country code (e.g. +1 for USA)",
    verificationCodeSent: isRussian ? "Код верификации отправлен" : "Verification code has been sent",
    verificationCodeLabel: isRussian ? "Код подтверждения" : "Verification Code",
    twoFactorAuthRequired: isRussian ? "Требуется двухфакторная аутентификация" : "Two-factor authentication is required",
    twoFactorPassword: isRussian ? "Пароль двухфакторной аутентификации" : "Two-Factor Password",
    cancel: isRussian ? "Отмена" : "Cancel",
    sendCode: isRussian ? "Отправить код" : "Send Code",
    verifyAndLogin: isRussian ? "Подтвердить и войти" : "Verify and Login",
    
    // Delete confirmation
    confirm: isRussian ? "Подтвердить" : "Confirm",
    deleteConfirmation: isRussian ? "Вы уверены, что хотите удалить эту сессию? Это действие нельзя отменить." : "Are you sure you want to delete this session? This action cannot be undone.",
    delete: isRussian ? "Удалить" : "Delete",
    
    // Errors and success messages
    fetchError: isRussian ? "Не удалось загрузить сессии. Пожалуйста, попробуйте снова." : "Failed to fetch sessions. Please try again.",
    phoneNumberRequired: isRussian ? "Требуется номер телефона" : "Phone number is required",
    verificationCodeRequired: isRussian ? "Требуется код подтверждения" : "Verification code is required",
    failedToSendCode: isRussian ? "Не удалось отправить код подтверждения" : "Failed to send verification code",
    failedToVerifyCode: isRussian ? "Не удалось подтвердить код" : "Failed to verify code",
    sessionAddedSuccess: isRussian ? "Сессия успешно добавлена" : "Session added successfully",
    sessionDeletedSuccess: isRussian ? "Сессия успешно удалена" : "Session deleted successfully",
    failedToDeleteSession: isRussian ? "Не удалось удалить сессию" : "Failed to delete session"
  };

  const steps = [
    texts.enterPhoneNumber,
    texts.verifyCode,
    texts.complete
  ];

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
      setError(texts.phoneNumberRequired);
      return;
    }

    try {
      setError('');
      const response = await sendVerificationCode(phoneNumber);
      if (response.data && response.data.phone_code_hash) {
        setPhoneCodeHash(response.data.phone_code_hash);
        setActiveStep(1);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error sending code:', err);
      setError(err.response?.data?.detail || texts.failedToSendCode);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError(texts.verificationCodeRequired);
      return;
    }

    try {
      await verifyCode({
        phoneNumber,
        code: verificationCode,
        phoneCodeHash,
        password: needsPassword ? twoFactorPassword : undefined
      });
      setSuccess(texts.sessionAddedSuccess);
      handleCloseDialog();
    } catch (err) {
      console.error('Error verifying code:', err);
      const errorMessage = err.response?.data?.detail;
      if (errorMessage === 'Two-factor authentication required') {
        setNeedsPassword(true);
        setError(texts.twoFactorAuthRequired);
      } else {
        setError(errorMessage || texts.failedToVerifyCode);
      }
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
      await deleteSession(sessionToDelete.id);
      
      // UI feedback after successful deletion
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      setSuccess(texts.sessionDeletedSuccess);
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(texts.failedToDeleteSession);
    }
  };

  const handleToggleStatus = (sessionId, currentStatus) => {
    const newStatus = !currentStatus;
    toggleSession(sessionId, newStatus);
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    return phone || '-'; // Return dash if phone is null/undefined
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 500 }}>
          {texts.pageTitle}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddSession}
          sx={{ 
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          {texts.addNewSession}
        </Button>
      </Box>
      
      {queryError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {typeof queryError === 'string' 
            ? queryError 
            : texts.fetchError}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : sessions.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            {texts.noSessionsFound}
          </Typography>
          <Typography variant="body1" paragraph>
            {texts.addYourFirstSession}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddSession}
          >
            {texts.addSession}
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '30%' }}>{texts.phoneNumber}</TableCell>
                <TableCell sx={{ width: '20%' }}>{texts.createdAt}</TableCell>
                <TableCell sx={{ width: '20%' }}>{texts.lastUsed}</TableCell>
                <TableCell sx={{ width: '15%' }} align="center">{texts.active}</TableCell>
                <TableCell sx={{ width: '15%' }} align="center">{texts.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    {formatPhoneNumber(session.phone)}
                  </TableCell>
                  <TableCell>
                    {session.created_at ? format(new Date(session.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    {session.last_used ? format(new Date(session.last_used), 'yyyy-MM-dd HH:mm') : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={session.is_active}
                      onChange={() => handleToggleStatus(session.id, session.is_active)}
                      disabled={isToggling}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={texts.delete}>
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteClick(session)}
                        disabled={isDeleting}
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
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        TransitionComponent={SlideTransition}
        sx={{
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(2px)',
            transition: 'backdrop-filter 225ms cubic-bezier(0.4, 0, 0.2, 1)'
          }
        }}
      >
        <DialogTitle>{texts.addTelegramSession}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, mt: 2 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          {activeStep === 0 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                {texts.enterPhoneNumberWithCountryCode}
              </Typography>
              <TextField
                fullWidth
                label={texts.phoneNumber}
                variant="outlined"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                margin="normal"
                placeholder={texts.phoneNumberPlaceholder}
                error={!!error}
                helperText={error || texts.phoneNumberHelperText}
                disabled={isSendingCode}
              />
            </Box>
          )}
          
          {activeStep === 1 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                {texts.verificationCodeSent}
              </Typography>
              
              <TextField
                fullWidth
                label={texts.verificationCodeLabel}
                variant="outlined"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                margin="normal"
                error={!!error && !needsPassword}
                helperText={!needsPassword && error}
                disabled={isVerifying}
              />
              
              {needsPassword && (
                <Box mt={2}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {texts.twoFactorAuthRequired}
                  </Alert>
                  <TextField
                    fullWidth
                    label={texts.twoFactorPassword}
                    variant="outlined"
                    type="password"
                    value={twoFactorPassword}
                    onChange={(e) => setTwoFactorPassword(e.target.value)}
                    margin="normal"
                    error={!!error}
                    helperText={error}
                    disabled={isVerifying}
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCloseDialog} 
            disabled={isSendingCode || isVerifying}
          >
            {texts.cancel}
          </Button>
          
          {activeStep === 0 && (
            <Button 
              onClick={handleSendCode} 
              variant="contained" 
              color="primary"
              disabled={!phoneNumber || isSendingCode}
            >
              {isSendingCode ? (
                <CircularProgress size={24} />
              ) : (
                texts.sendCode
              )}
            </Button>
          )}
          
          {activeStep === 1 && (
            <Button 
              onClick={handleVerifyCode} 
              variant="contained" 
              color="primary"
              disabled={!verificationCode || (needsPassword && !twoFactorPassword) || isVerifying}
            >
              {isVerifying ? (
                <CircularProgress size={24} />
              ) : (
                texts.verifyAndLogin
              )}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleDeleteCancel}
        TransitionComponent={SlideTransition}
        sx={{
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(2px)',
            transition: 'backdrop-filter 225ms cubic-bezier(0.4, 0, 0.2, 1)'
          }
        }}
      >
        <DialogTitle>{texts.confirm}</DialogTitle>
        <DialogContent>
          <Typography>
            {texts.deleteConfirmation}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isDeleting}>
            {texts.cancel}
          </Button>
          <Button 
            onClick={handleDeleteSession} 
            color="error" 
            variant="contained" 
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={24} /> : texts.delete}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TelegramSessions; 