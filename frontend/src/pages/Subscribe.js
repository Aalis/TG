import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Container,
  Grid,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  Snackbar,
  Alert,
  Paper,
  Divider,
  Link,
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  ContentCopy as CopyIcon,
  QrCode2 as QrCodeIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Telegram as TelegramIcon,
} from '@mui/icons-material';

const Subscribe = () => {
  const { t } = useTranslation();
  const [selectedNetwork, setSelectedNetwork] = useState(0);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [copySnackbar, setCopySnackbar] = useState(false);
  
  const plans = [
    {
      title: t('subscription.basicPlan'),
      price: '$2',
      duration: t('subscription.oneDayAccess'),
      amount: 2
    },
    {
      title: t('subscription.standardPlan'),
      price: '$5',
      duration: t('subscription.fiveDaysAccess'),
      amount: 5
    },
    {
      title: t('subscription.premiumPlan'),
      price: '$10',
      duration: t('subscription.twentyDaysAccess'),
      amount: 10
    }
  ];

  const networks = [
    {
      name: 'USDT TRC20',
      address: 'TQihkZKkPdRjGX1QN7GxmoQTtsiPQtbehQ',
      protocol: 'tron',
      info: t('subscription.tronNetwork'),
      color: '#FF060A',
      qrPrefix: 'tron:',
      icon: '💎'
    },
    {
      name: 'BTC',
      address: 'bc1q0r3nmn4fwxeesagnsh4sukhv9ankdpyu56zzzs',
      protocol: 'bitcoin',
      info: t('subscription.bitcoinNetwork'),
      color: '#F7931A',
      qrPrefix: 'bitcoin:',
      icon: '₿'
    },
    {
      name: 'ETH',
      address: '0xDd2C0e3B2E144717eAFD97251D4939a2ee5ECa0f',
      protocol: 'ethereum',
      info: t('subscription.ethereumNetwork'),
      color: '#627EEA',
      qrPrefix: 'ethereum:',
      icon: 'Ξ'
    }
  ];

  const handleCopyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopySnackbar(true);
  };

  const handleNetworkChange = (event, newValue) => {
    setSelectedNetwork(newValue);
  };

  const handleOpenQR = (plan) => {
    setSelectedPlan(plan);
    setQrDialogOpen(true);
  };

  const handleCloseQR = () => {
    setQrDialogOpen(false);
    setSelectedPlan(null);
  };

  const handleCloseSnackbar = () => {
    setCopySnackbar(false);
  };

  // Generate QR code URL using a free QR code API
  const getQRCodeUrl = (network, amount) => {
    const paymentUri = `${network.qrPrefix}${network.address}${amount ? `?amount=${amount}` : ''}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUri)}`;
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('subscription.subscriptionPlans')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('subscription.choosePlan').split('@aalis92').map((part, index) => {
            if (index === 0) {
              return (
                <React.Fragment key={index}>
                  {part}
                  <Link 
                    href="https://t.me/aalis92" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    sx={{ 
                      display: 'inline-flex', 
                      alignItems: 'center',
                      mx: 0.5,
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    <TelegramIcon fontSize="small" sx={{ mr: 0.5 }} />
                    @aalis92
                  </Link>
                </React.Fragment>
              );
            }
            return part;
          })}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {plans.map((plan) => (
          <Grid item xs={12} sm={6} md={4} key={plan.title}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)'
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  {plan.title}
                </Typography>
                
                <Typography variant="h3" component="div" color="primary" gutterBottom>
                  {plan.price}
                </Typography>
                
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  {plan.duration}
                </Typography>

                <Box sx={{ mt: 'auto' }}>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs 
                      value={selectedNetwork}
                      onChange={handleNetworkChange}
                      variant="fullWidth"
                      sx={{ minHeight: '42px' }}
                    >
                      {networks.map((network, index) => (
                        <Tab 
                          key={network.name}
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <span style={{ marginRight: '4px' }}>{network.icon}</span>
                              {network.name}
                            </Box>
                          }
                          value={index}
                          sx={{ 
                            minHeight: '42px',
                            fontSize: '0.875rem',
                            textTransform: 'none'
                          }}
                        />
                      ))}
                    </Tabs>
                  </Box>

                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={8}>
                      <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        size="large"
                        startIcon={<ShoppingCartIcon />}
                        href={`${networks[selectedNetwork].qrPrefix}${networks[selectedNetwork].address}?amount=${plan.amount}`}
                        sx={{ height: '100%' }}
                      >
                        {t('subscription.payWith')} {networks[selectedNetwork].icon}
                      </Button>
                    </Grid>
                    <Grid item xs={4}>
                      <Button
                        variant="outlined"
                        color="primary"
                        fullWidth
                        size="large"
                        onClick={() => handleOpenQR(plan)}
                        sx={{ height: '100%' }}
                      >
                        <QrCodeIcon />
                      </Button>
                    </Grid>
                  </Grid>

                  <Paper 
                    elevation={0} 
                    sx={{ 
                      bgcolor: 'background.default',
                      p: 2,
                      borderRadius: 1,
                      fontSize: '0.875rem',
                      position: 'relative'
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {networks[selectedNetwork].name} {t('subscription.address')}:
                    </Typography>
                    
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: 'background.paper',
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider'
                    }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          wordBreak: 'break-all',
                          mr: 1,
                          maxWidth: 'calc(100% - 40px)'
                        }}
                      >
                        {networks[selectedNetwork].address}
                      </Typography>
                      <Tooltip title={t('subscription.copyAddress')} placement="top">
                        <IconButton 
                          size="small"
                          onClick={() => handleCopyAddress(networks[selectedNetwork].address)}
                          color="primary"
                          sx={{ flexShrink: 0 }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 6, mb: 4 }}>
        <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            {t('subscription.importantNotes')}:
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <Box component="li" sx={{ mb: 1 }}>
              {t('subscription.sendExactAmount')}
            </Box>
            <Box component="li" sx={{ mb: 1 }}>
              {t('subscription.lowestFees')}
            </Box>
            <Box component="li" sx={{ mb: 1 }}>
              {t('subscription.activationTime')}
            </Box>
            <Box component="li">
              {t('subscription.useCorrectNetwork')}
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onClose={handleCloseQR} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedPlan?.title} - {networks[selectedNetwork].name}
            </Typography>
            <IconButton edge="end" color="inherit" onClick={handleCloseQR} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('subscription.scanQRCode')}
            </Typography>
            
            <Box 
              component="img" 
              src={selectedPlan ? getQRCodeUrl(networks[selectedNetwork], selectedPlan.amount) : ''} 
              alt="QR Code"
              sx={{ 
                width: '100%', 
                maxWidth: 200, 
                height: 'auto', 
                margin: '0 auto',
                display: 'block',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                bgcolor: 'background.paper'
              }}
            />
            
            <Typography variant="h6" sx={{ mt: 2, color: 'primary.main' }}>
              {selectedPlan?.price}
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {networks[selectedNetwork].name} {t('subscription.address')}:
              </Typography>
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 1.5, 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {networks[selectedNetwork].address}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => handleCopyAddress(networks[selectedNetwork].address)}
                  color="primary"
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Paper>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Copy Success Snackbar */}
      <Snackbar
        open={copySnackbar}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity="success"
          variant="filled"
          sx={{ width: '100%' }}
          icon={<CheckCircleIcon fontSize="inherit" />}
        >
          {t('subscription.addressCopied')}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Subscribe; 