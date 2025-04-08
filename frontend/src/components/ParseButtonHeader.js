import React from 'react';
import { Box, Typography, Button, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

/**
 * A consistent header component that displays a title and a Parse New button
 * This ensures the button stays in the same place across different views
 */
const ParseButtonHeader = ({ 
  title, 
  buttonText, 
  onButtonClick, 
  entityType = 'channel', // 'channel' or 'group'
  disabled = false,
  disabledTooltip = ''
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // If no specific button text is provided, use the default based on entity type
  const defaultButtonText = entityType === 'channel' 
    ? t('telegram.parseNewChannel') 
    : t('telegram.parseNewGroup');

  // For mobile, show a more compact version
  const buttonContent = isMobile ? (
    <Button
      variant="contained"
      color="primary"
      onClick={onButtonClick}
      disabled={disabled}
      size="small"
      sx={{
        minWidth: 'auto',
        px: 2,
        py: 1,
        fontSize: '0.875rem',
        whiteSpace: 'nowrap',
        '& .MuiButton-startIcon': {
          mr: 0.5,
        },
      }}
    >
      <AddIcon fontSize="small" />
      {entityType === 'channel' ? t('common.newChannel', 'New') : t('common.newGroup', 'New')}
    </Button>
  ) : (
    <Button
      variant="contained"
      color="primary"
      startIcon={<AddIcon />}
      onClick={onButtonClick}
      disabled={disabled}
      sx={{
        textTransform: 'uppercase',
        fontSize: { xs: '0.75rem', sm: '0.875rem' },
        py: 0.75,
        px: 2,
        height: '32px',
        minHeight: '32px',
        whiteSpace: 'nowrap',
        '& .MuiButton-startIcon': {
          marginRight: 0.5
        }
      }}
    >
      {buttonText || defaultButtonText}
    </Button>
  );

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'background.default',
        py: 1
      }}
    >
      <Typography 
        variant={isMobile ? "h5" : "h4"} 
        component="h1"
        sx={{
          fontSize: isMobile ? '1.5rem' : undefined,
        }}
      >
        {title}
      </Typography>
      
      {disabled && disabledTooltip ? (
        <Tooltip title={disabledTooltip}>
          <span>{buttonContent}</span>
        </Tooltip>
      ) : (
        buttonContent
      )}
    </Box>
  );
};

export default ParseButtonHeader; 