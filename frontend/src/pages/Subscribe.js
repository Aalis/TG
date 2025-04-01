import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Typography,
  Container,
  Paper,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Tooltip,
  Stack,
  Dialog,
  DialogContent,
  useTheme,
} from '@mui/material';
import {
  Telegram as TelegramIcon,
  Info as InfoIcon,
  CalendarToday as CalendarIcon,
  ContentCopy as ContentCopyIcon,
  QrCode2 as QrCodeIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import QRCode from 'qrcode';

const Subscribe = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const [qrDialog, setQrDialog] = useState({ open: false, address: '', label: '', type: '' });
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  const addresses = {
    usdt: 'TQihkZKkPdRjGX1QN7GxmoQTtsiPQtbehQ',
    eth: '0xDd2C0e3B2E144717eAFD97251D4939a2ee5ECa0f',
    btc: 'bc1q0r3nmn4fwxeesagnsh4sukhv9ankdpyu56zzzs'
  };

  // Check if user is in demo mode (no can_parse permission)
  const isInDemoMode = user && user.is_active && !user.can_parse;

  useEffect(() => {
    if (qrDialog.address && qrDialog.type) {
      // Add appropriate scheme based on cryptocurrency type
      let qrContent = qrDialog.address;
      if (qrDialog.type === 'btc') {
        qrContent = `bitcoin:${qrDialog.address}`;
      } else if (qrDialog.type === 'eth') {
        qrContent = `ethereum:${qrDialog.address}`;
      } else if (qrDialog.type === 'usdt') {
        qrContent = `tron:${qrDialog.address}`;
      }

      QRCode.toDataURL(qrContent, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'H'
      })
      .then(url => {
        setQrCodeUrl(url);
      })
      .catch(err => {
        console.error(err);
      });
    }
  }, [qrDialog.address, qrDialog.type]);

  const handleCopyAddress = (address) => {
    navigator.clipboard.writeText(address);
  };

  const handleOpenQR = (address, label, type) => {
    setQrDialog({ open: true, address, label, type });
  };

  const handleCloseQR = () => {
    setQrDialog({ open: false, address: '', label: '', type: '' });
    setQrCodeUrl('');
  };

  const CryptoAddress = ({ type, address, label }) => (
    <Box sx={{ 
      p: 2, 
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 1,
      border: `1px solid ${theme.palette.divider}`
    }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          color: 'text.secondary',
          mb: 1
        }}
      >
        {label}
      </Typography>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 1,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
        p: 1.5,
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`
      }}>
        <Typography 
          sx={{ 
            color: 'text.primary',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            flexGrow: 1,
            wordBreak: 'break-all'
          }}
        >
          {address}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={t('subscribe.showQRCode')}>
            <IconButton 
              onClick={() => handleOpenQR(address, label, type)}
              size="small"
              sx={{ 
                color: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' 
                    ? 'rgba(33, 150, 243, 0.1)' 
                    : 'rgba(33, 150, 243, 0.05)'
                }
              }}
            >
              <QrCodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('subscribe.copyAddress')}>
            <IconButton 
              onClick={() => handleCopyAddress(address)}
              size="small"
              sx={{ 
                color: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' 
                    ? 'rgba(33, 150, 243, 0.1)' 
                    : 'rgba(33, 150, 243, 0.05)'
                }
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 2 }}>
      <Typography 
        variant="h5" 
        component="h1" 
        gutterBottom 
        sx={{ 
          color: 'text.primary',
          fontWeight: 500,
          mb: 3,
          display: 'none'
        }}
      >
        {t('subscription.title')}
      </Typography>

      <Paper 
        sx={{ 
          bgcolor: 'background.paper',
          borderRadius: 1,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ 
          p: 2, 
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : isInDemoMode ? theme.palette.primary.light : theme.palette.success.light,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <InfoIcon sx={{ color: isInDemoMode ? theme.palette.primary.main : theme.palette.success.main }} />
            <Typography variant="subtitle1" sx={{ color: theme.palette.mode === 'dark' ? 'text.primary' : isInDemoMode ? theme.palette.primary.contrastText : theme.palette.success.contrastText }}>
              {isInDemoMode ? t('subscription.testPeriod') : t('subscription.subscribedMessage')}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ p: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: 'text.secondary',
            mb: 3
          }}>
            <Typography>
              {t('subscription.contactText')}
            </Typography>
            <Link
              href="https://t.me/aalis92"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                color: theme.palette.primary.main,
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              <TelegramIcon sx={{ fontSize: 20 }} />
              @aalis92
            </Link>
            <Typography>
              {t('subscription.onTelegram')}
            </Typography>
          </Box>

          <List sx={{ 
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
            borderRadius: 1,
            overflow: 'hidden'
          }}>
            <ListItem>
              <ListItemIcon>
                <CalendarIcon sx={{ color: theme.palette.primary.main }} />
              </ListItemIcon>
              <ListItemText 
                primary={t('subscription.price1Day')}
                sx={{ 
                  '& .MuiListItemText-primary': { 
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    fontWeight: 500
                  }
                }}
              />
            </ListItem>
            <Divider sx={{ borderColor: theme.palette.divider }} />
            <ListItem>
              <ListItemIcon>
                <CalendarIcon sx={{ color: theme.palette.primary.main }} />
              </ListItemIcon>
              <ListItemText 
                primary={t('subscription.price5Days')}
                sx={{ 
                  '& .MuiListItemText-primary': { 
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    fontWeight: 500
                  }
                }}
              />
            </ListItem>
            <Divider sx={{ borderColor: theme.palette.divider }} />
            <ListItem>
              <ListItemIcon>
                <CalendarIcon sx={{ color: theme.palette.primary.main }} />
              </ListItemIcon>
              <ListItemText 
                primary={t('subscription.price20Days')}
                sx={{ 
                  '& .MuiListItemText-primary': { 
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    fontWeight: 500
                  }
                }}
              />
            </ListItem>
          </List>

          <Stack spacing={2} sx={{ mt: 3 }}>
            <CryptoAddress 
              type="usdt"
              address={addresses.usdt}
              label={t('subscription.usdtAddress')}
            />
            <CryptoAddress 
              type="eth"
              address={addresses.eth}
              label={t('subscription.ethAddress')}
            />
            <CryptoAddress 
              type="btc"
              address={addresses.btc}
              label={t('subscription.btcAddress')}
            />
          </Stack>
        </Box>
      </Paper>

      <Dialog 
        open={qrDialog.open} 
        onClose={handleCloseQR}
        PaperProps={{
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            maxWidth: '90vw',
            width: 'auto'
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}>
          <Typography variant="h6">
            {qrDialog.label}
          </Typography>
          <IconButton 
            onClick={handleCloseQR}
            sx={{ color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <DialogContent sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: 2,
          p: 3,
          bgcolor: 'background.paper'
        }}>
          <Box sx={{ 
            bgcolor: '#fff', 
            p: 2, 
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 200,
            height: 200,
            border: theme.palette.mode === 'light' ? '1px solid rgba(0, 0, 0, 0.1)' : 'none'
          }}>
            {qrCodeUrl && (
              <img 
                src={qrCodeUrl} 
                alt={t('subscription.qrCodeAlt')}
                style={{ 
                  width: '100%',
                  height: '100%',
                  display: 'block'
                }} 
              />
            )}
          </Box>
          <Typography 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.9rem',
              textAlign: 'center',
              maxWidth: '280px',
              wordBreak: 'break-all'
            }}
          >
            {qrDialog.address}
          </Typography>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Subscribe; 