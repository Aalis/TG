import React, { useState } from 'react';
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
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  ContentCopy as CopyIcon,
  QrCode2 as QrCodeIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

const Subscribe = () => {
  const [selectedNetwork, setSelectedNetwork] = useState(0);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [copySnackbar, setCopySnackbar] = useState(false);
  
  const plans = [
    {
      title: 'Basic Plan',
      price: '$2',
      duration: '1 Day Access',
      amount: 2
    },
    {
      title: 'Standard Plan',
      price: '$5',
      duration: '5 Days Access',
      amount: 5
    },
    {
      title: 'Premium Plan',
      price: '$10',
      duration: '20 Days Access',
      amount: 10
    }
  ];

  const networks = [
    {
      name: 'USDT TRC20',
      address: 'TQihkZKkPdRjGX1QN7GxmoQTtsiPQtbehQ',
      protocol: 'tron',
      info: 'TRON Network (Lowest fees)',
      color: '#FF060A',
      qrPrefix: 'tron:',
      icon: '💎'
    },
    {
      name: 'BTC',
      address: 'bc1q0r3nmn4fwxeesagnsh4sukhv9ankdpyu56zzzs',
      protocol: 'bitcoin',
      info: 'Bitcoin Network',
      color: '#F7931A',
      qrPrefix: 'bitcoin:',
      icon: '₿'
    },
    {
      name: 'ETH',
      address: '0xDd2C0e3B2E144717eAFD97251D4939a2ee5ECa0f',
      protocol: 'ethereum',
      info: 'Ethereum Network',
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
          Subscription Plans
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Choose a plan that works best for you
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
                        Pay with {networks[selectedNetwork].icon}
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
                      {networks[selectedNetwork].name} Address:
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
                      <Tooltip title="Copy Address" placement="top">
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
                    
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ 
                        display: 'block', 
                        mt: 1,
                        fontStyle: 'italic'
                      }}
                    >
                      {networks[selectedNetwork].info}
                    </Typography>
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mt: 4, p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="subtitle1" color="text.primary" gutterBottom>
          Important Notes:
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
          <li>Please send the exact amount in the selected cryptocurrency</li>
          <li>USDT TRC20 (TRON) has the lowest transaction fees</li>
          <li>After payment, your subscription will be activated manually within 24 hours</li>
          <li>Make sure to use the correct network for your transaction</li>
        </Typography>
      </Paper>

      {/* QR Code Dialog */}
      <Dialog 
        open={qrDialogOpen} 
        onClose={handleCloseQR}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {networks[selectedNetwork].icon} {networks[selectedNetwork].name} Payment
            </Typography>
            <IconButton onClick={handleCloseQR} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            p: 2 
          }}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 3, 
                borderRadius: 2, 
                width: '100%', 
                mb: 3,
                textAlign: 'center'
              }}
            >
              <Typography variant="h5" color="primary" gutterBottom>
                ${selectedPlan?.amount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedPlan?.duration}
              </Typography>
            </Paper>
            
            <Paper 
              elevation={0} 
              sx={{ 
                bgcolor: 'white', 
                p: 3, 
                borderRadius: 2,
                mb: 3,
                border: '1px solid',
                borderColor: 'divider',
                width: '100%',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <img 
                src={selectedPlan ? getQRCodeUrl(networks[selectedNetwork], selectedPlan.amount) : ''}
                alt="QR Code"
                style={{ 
                  width: '200px',
                  height: '200px',
                  display: 'block'
                }}
              />
            </Paper>
            
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                borderRadius: 1, 
                width: '100%',
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Wallet Address:
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
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleCopyAddress(networks[selectedNetwork].address)}
                  startIcon={<CopyIcon />}
                  sx={{ flexShrink: 0 }}
                >
                  Copy
                </Button>
              </Box>
              
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: 'block', 
                  mt: 2,
                  textAlign: 'center'
                }}
              >
                Scan this QR code with your {networks[selectedNetwork].name} wallet app
              </Typography>
            </Paper>
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
          sx={{ width: '100%' }}
          icon={<CheckCircleIcon fontSize="inherit" />}
        >
          Address copied to clipboard!
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Subscribe; 