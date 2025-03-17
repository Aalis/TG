import React from 'react';
import { Box, Typography, Button } from '@mui/material';
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
  entityType = 'channel' // 'channel' or 'group'
}) => {
  const { t } = useTranslation();
  
  // If no specific button text is provided, use the default based on entity type
  const defaultButtonText = entityType === 'channel' 
    ? t('telegram.parseNewChannel') 
    : t('telegram.parseNewGroup');
  
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
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={onButtonClick}
      >
        {buttonText || defaultButtonText}
      </Button>
    </Box>
  );
};

export default ParseButtonHeader; 