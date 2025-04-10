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
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  CardActions,
  Stack,
  AppBar,
  Toolbar,
  BottomNavigation,
  BottomNavigationAction,
  Grid,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, ArrowBack as ArrowBackIcon, Home as HomeIcon, Group as GroupIcon, Chat as ChatIcon, Person as PersonIcon } from '@mui/icons-material';
import { sessionsAPI } from '../services/api';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useSessions } from '../hooks/useSessions';
import { useSnackbar } from 'notistack';
import { SlideTransition } from '../utils/transitions';

const TelegramSessions = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
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

  // Add event listener for the custom 'add-telegram-session' event
  useEffect(() => {
    const handleAddSessionEvent = () => {
      handleAddSession();
    };

    document.addEventListener('add-telegram-session', handleAddSessionEvent);
    
    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener('add-telegram-session', handleAddSessionEvent);
    };
  }, []);

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
      setError(t('telegram.phoneNumberRequired', 'Phone number is required'));
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
      setError(err.response?.data?.detail || t('telegram.failedToSendCode', 'Failed to send verification code'));
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      setError(t('telegram.verificationCodeRequired', 'Verification code is required'));
      return;
    }

    try {
      await verifyCode({
        phoneNumber,
        code: verificationCode,
        phoneCodeHash,
        password: needsPassword ? twoFactorPassword : undefined
      });
      setSuccess(t('telegram.sessionAddedSuccess', 'Session added successfully'));
      handleCloseDialog();
    } catch (err) {
      console.error('Error verifying code:', err);
      
      // Log the complete error object to help debug
      console.log('Full error object:', JSON.stringify(err, null, 2));
      
      // Check for error status code 400 as an indicator of possible 2FA requirement
      const status = err.response?.status;
      const errorDetail = err.response?.data?.detail || '';
      
      console.log('Error status:', status);
      console.log('Error detail:', errorDetail);
      
      // If we get a 400 status with empty detail or 2FA message, assume 2FA is required
      if (status === 400 && (
          errorDetail === '' || 
          errorDetail === 'Two-factor authentication required' ||
          errorDetail?.includes('2FA') || 
          errorDetail?.includes('two-factor') || 
          errorDetail?.includes('password required'))) {
        // Show 2FA password input
        setNeedsPassword(true);
        setError(t('telegram.twoFactorAuthRequired', 'Two-factor authentication is required'));
      } else {
        // Other errors
        setError(errorDetail || t('telegram.failedToVerifyCode', 'Failed to verify code'));
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
      setSuccess(t('telegram.sessionDeletedSuccess', 'Session deleted successfully'));
    } catch (err) {
      console.error('Error deleting session:', err);
      setError(t('telegram.failedToDeleteSession', 'Failed to delete session'));
    }
  };

  const handleToggleStatus = (sessionId, currentStatus) => {
    const newStatus = !currentStatus;
    toggleSession(sessionId, newStatus);
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '-';
    const lastFourDigits = phone.slice(-4);
    const maskedLength = phone.length - 4;
    return '*'.repeat(maskedLength) + lastFourDigits;
  };

  return (
    <Box sx={{ p: isMobile ? 0 : 0 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {queryError?.message || t('telegram.failedToFetchSessions', 'Failed to fetch sessions')}
        </Alert>
      ) : sessions?.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary" mb={2}>
            {t('telegram.noActiveSessionsFound', 'No active sessions found')}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {t('telegram.addYourFirstSession', 'Add your first session')}
          </Typography>
          <Button 
            variant="contained"
            onClick={handleAddSession}
            startIcon={<AddIcon />}
          >
            {t('telegram.addSession', 'Add Session')}
          </Button>
        </Box>
      ) : (
        <>
          {isMobile ? (
            <Box sx={{ width: '100%' }}>
              <Grid 
                container 
                spacing={0}
                sx={{ 
                  width: '100%',
                  mx: 0,
                  px: 0
                }}
              >
                {sessions.map((session) => (
                  <Grid 
                    item 
                    xs={12} 
                    key={session.id} 
                    sx={{ 
                      width: '100%',
                      mb: 1.5
                    }}
                  >
                    <Card sx={{ 
                      borderRadius: 1,
                      width: '100%',
                      maxWidth: '100%', 
                      bgcolor: 'background.paper',
                      boxSizing: 'border-box',
                      '&:hover': {
                        boxShadow: (theme) => `0px 2px 8px ${theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'}`
                      }
                    }}>
                      <CardContent sx={{ 
                        p: 0, 
                        pb: '0 !important',
                        '&:last-child': { pb: '0 !important' } 
                      }}>
                        <Box sx={{ 
                          p: 2,
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center' 
                        }}>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 0.5 }}>
                              {formatPhoneNumber(session.phone)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              {session.created_at ? format(new Date(session.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Switch
                              checked={session.is_active}
                              onChange={() => handleToggleStatus(session.id, session.is_active)}
                              disabled={isToggling}
                              size="small"
                            />
                            <IconButton 
                              color="error" 
                              onClick={() => handleDeleteClick(session)}
                              disabled={isDeleting}
                              size="small"
                              sx={{ ml: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('telegram.phone', 'Phone')}</TableCell>
                    <TableCell>{t('telegram.createdAt', 'Created At')}</TableCell>
                    <TableCell>{t('common.lastUsed', 'Last Used')}</TableCell>
                    <TableCell>{t('telegram.status', 'Status')}</TableCell>
                    <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell component="th" scope="row">
                        {formatPhoneNumber(session.phone)}
                      </TableCell>
                      <TableCell>
                        {session.created_at ? format(new Date(session.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        {session.last_used ? format(new Date(session.last_used), 'yyyy-MM-dd HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={session.is_active}
                          onChange={() => handleToggleStatus(session.id, session.is_active)}
                          disabled={isToggling}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          color="error" 
                          onClick={() => handleDeleteClick(session)}
                          disabled={isDeleting}
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
        </>
      )}
      
      {/* Add Session Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        TransitionComponent={SlideTransition}
        PaperProps={{
          elevation: 0,
          sx: {
            bgcolor: isMobile ? 'rgba(33, 33, 33, 0.95)' : 'background.paper',
            borderRadius: 2,
            width: '90%',
            maxWidth: '400px'
          }
        }}
        sx={{
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(2px)',
            transition: 'backdrop-filter 225ms cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }
        }}
      >
        <DialogContent sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          p: 3,
          gap: 2
        }}>
          <Typography variant="h6" sx={{ color: isMobile ? '#fff' : 'text.primary', mb: 1 }}>
            {t('telegram.addTelegramSession', 'Add Telegram Session')}
          </Typography>

          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography sx={{ color: isMobile ? '#fff' : 'text.primary' }}>
                {t('telegram.enterPhoneNumberWithCountryCode', 'Enter phone number with country code')}
              </Typography>

              <TextField
                fullWidth
                variant="outlined"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                error={!!error}
                helperText={error || t('telegram.phoneNumberHelperText', 'Example: +1234567890')}
                disabled={isSendingCode}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isMobile ? 'rgba(255, 255, 255, 0.05)' : 'background.paper',
                    borderRadius: 1,
                    '& fieldset': {
                      borderColor: isMobile ? '#2196f3' : 'primary.main'
                    },
                    '& input': {
                      color: isMobile ? '#fff' : 'text.primary',
                      fontSize: '1rem',
                      py: 1.5
                    },
                    '&:hover fieldset': {
                      borderColor: isMobile ? '#1976d2' : 'primary.dark'
                    }
                  },
                  '& .MuiFormHelperText-root': {
                    color: error ? 'error.main' : (isMobile ? 'rgba(255, 255, 255, 0.6)' : 'text.secondary'),
                    ml: 0,
                    mt: 1
                  }
                }}
              />
              
              <Box sx={{ 
                display: 'flex', 
                gap: 2,
                '& .MuiButton-root': {
                  flex: 1,
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'uppercase'
                }
              }}>
                <Button 
                  onClick={handleCloseDialog}
                  sx={{ 
                    color: isMobile ? '#9e9e9e' : 'text.secondary',
                    '&:hover': {
                      bgcolor: isMobile ? 'rgba(158, 158, 158, 0.08)' : 'action.hover'
                    }
                  }}
                >
                  {t('common.cancel', 'CANCEL')}
                </Button>

                <Button 
                  onClick={handleSendCode}
                  variant={isMobile ? "contained" : "contained"}
                  color="primary"
                  disabled={!phoneNumber || isSendingCode}
                >
                  {isSendingCode ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    t('telegram.sendCode', 'SEND CODE')
                  )}
                </Button>
              </Box>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography sx={{ color: isMobile ? '#fff' : 'text.primary' }}>
                {t('telegram.enterVerificationCode', 'Enter verification code')}
              </Typography>

              <TextField
                fullWidth
                variant="outlined"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder={t('telegram.verificationCode', 'Verification Code')}
                error={!!error}
                helperText={error}
                disabled={isVerifying}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isMobile ? 'rgba(255, 255, 255, 0.05)' : 'background.paper',
                    borderRadius: 1,
                    '& fieldset': {
                      borderColor: isMobile ? '#2196f3' : 'primary.main'
                    },
                    '& input': {
                      color: isMobile ? '#fff' : 'text.primary',
                      fontSize: '1rem',
                      py: 1.5
                    }
                  },
                  '& .MuiFormHelperText-root': {
                    color: error ? 'error.main' : (isMobile ? 'rgba(255, 255, 255, 0.6)' : 'text.secondary'),
                    ml: 0,
                    mt: 1
                  }
                }}
              />

              {needsPassword && (
                <TextField
                  fullWidth
                  type="password"
                  variant="outlined"
                  value={twoFactorPassword}
                  onChange={(e) => setTwoFactorPassword(e.target.value)}
                  placeholder={t('telegram.twoFactorPassword', '2FA Password')}
                  error={!!error}
                  disabled={isVerifying}
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      bgcolor: isMobile ? 'rgba(255, 255, 255, 0.05)' : 'background.paper',
                      borderRadius: 1,
                      '& fieldset': {
                        borderColor: isMobile ? '#2196f3' : 'primary.main'
                      },
                      '& input': {
                        color: isMobile ? '#fff' : 'text.primary',
                        fontSize: '1rem',
                        py: 1.5
                      }
                    },
                    '& .MuiFormHelperText-root': {
                      color: error ? 'error.main' : (isMobile ? 'rgba(255, 255, 255, 0.6)' : 'text.secondary'),
                      ml: 0,
                      mt: 1
                    }
                  }}
                />
              )}

              <Box sx={{ 
                display: 'flex', 
                gap: 2,
                '& .MuiButton-root': {
                  flex: 1,
                  py: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'uppercase'
                }
              }}>
                <Button 
                  onClick={handleCloseDialog}
                  sx={{ 
                    color: isMobile ? '#9e9e9e' : 'text.secondary',
                    '&:hover': {
                      bgcolor: isMobile ? 'rgba(158, 158, 158, 0.08)' : 'action.hover'
                    }
                  }}
                >
                  {t('common.cancel', 'CANCEL')}
                </Button>

                <Button 
                  onClick={handleVerifyCode}
                  variant={isMobile ? "contained" : "contained"}
                  color="primary"
                  disabled={!verificationCode || (needsPassword && !twoFactorPassword) || isVerifying}
                >
                  {isVerifying ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    t('telegram.verifyCode', 'VERIFY')
                  )}
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={handleDeleteCancel}
        PaperProps={{
          elevation: 0,
          sx: {
            bgcolor: 'rgba(33, 33, 33, 0.95)',
            borderRadius: 2,
            width: '90%',
            maxWidth: '400px'
          }
        }}
        sx={{
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(2px)',
            transition: 'backdrop-filter 225ms cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
          }
        }}
      >
        <DialogContent sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          p: 3,
          gap: 2
        }}>
          <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
            {t('actions.confirm', 'Подтвердить')}
          </Typography>

          <Typography sx={{ color: '#fff', mb: 2 }}>
            {sessionToDelete ? (
              t('telegram.deleteSessionConfirmWithName', 'Вы уверены, что хотите удалить "{{name}}"? Это действие нельзя отменить.', {
                name: formatPhoneNumber(sessionToDelete.phone)
              })
            ) : (
              t('telegram.deleteSessionConfirm', 'Вы уверены, что хотите удалить этот сеанс? Это действие нельзя отменить.')
            )}
          </Typography>

          <Box sx={{ 
            display: 'flex', 
            gap: 2,
            '& .MuiButton-root': {
              flex: 1,
              py: 1,
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'uppercase'
            }
          }}>
            <Button 
              onClick={handleDeleteCancel}
              sx={{ 
                color: '#2196f3',
                '&:hover': {
                  bgcolor: 'rgba(33, 150, 243, 0.08)'
                }
              }}
            >
              {t('common.cancel', 'ОТМЕНА')}
            </Button>

            <Button 
              onClick={handleDeleteSession}
              disabled={isDeleting}
              sx={{ 
                bgcolor: '#f44336',
                color: '#fff',
                '&:hover': {
                  bgcolor: '#d32f2f'
                },
                '&:disabled': {
                  bgcolor: 'rgba(244, 67, 54, 0.5)',
                  color: 'rgba(255, 255, 255, 0.5)'
                }
              }}
            >
              {isDeleting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                t('actions.delete', 'УДАЛИТЬ')
              )}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default TelegramSessions; 