import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const [qrDialog, setQrDialog] = useState({ open: false, address: '', label: '', type: '' });
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  const addresses = {
    usdt: 'TQihkZKkPdRjGX1QN7GxmoQTtsiPQtbehQ',
    eth: '0xDd2C0e3B2E144717eAFD97251D4939a2ee5ECa0f',
    btc: 'bc1q0r3nmn4fwxeesagnsh4sukhv9ankdpyu56zzzs'
  };

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
      bgcolor: '#1e1e1e', 
      borderRadius: 1,
      border: '1px solid rgba(255, 255, 255, 0.1)'
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
        bgcolor: 'rgba(255, 255, 255, 0.05)',
        p: 1.5,
        borderRadius: 1,
        border: '1px solid rgba(255, 255, 255, 0.1)'
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
                color: '#2196f3',
                '&:hover': {
                  bgcolor: 'rgba(33, 150, 243, 0.1)'
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
                color: '#2196f3',
                '&:hover': {
                  bgcolor: 'rgba(33, 150, 243, 0.1)'
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
          bgcolor: '#1e1e1e',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <InfoIcon sx={{ color: '#2196f3' }} />
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              {t('subscription.testPeriod')}
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
                color: '#2196f3',
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
            bgcolor: '#1e1e1e', 
            borderRadius: 1,
            overflow: 'hidden'
          }}>
            <ListItem>
              <ListItemIcon>
                <CalendarIcon sx={{ color: '#2196f3' }} />
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
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            <ListItem>
              <ListItemIcon>
                <CalendarIcon sx={{ color: '#2196f3' }} />
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
            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            <ListItem>
              <ListItemIcon>
                <CalendarIcon sx={{ color: '#2196f3' }} />
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
            bgcolor: '#1e1e1e',
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
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
          bgcolor: '#1e1e1e'
        }}>
          <Box sx={{ 
            bgcolor: '#fff', 
            p: 2, 
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 200,
            height: 200
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