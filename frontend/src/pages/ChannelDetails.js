import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Divider,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  FormControlLabel,
  Switch,
  useTheme,
  useMediaQuery,
  Container,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  SmartToy as BotIcon,
  Add as AddIcon,
  Telegram as TelegramIcon,
  Home as HomeIcon,
  Group as GroupsIcon,
  Forum as ChannelsIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { channelsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

const ChannelDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPremium, setShowOnlyPremium] = useState(false);
  const [showOnlyWithUsername, setShowOnlyWithUsername] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [value, setValue] = useState(location.pathname);

  // Consider a user in demo mode if they are active but don't have can_parse permission
  // OR if their parse permission has expired
  const isInDemoMode = (user?.is_active && !user?.can_parse) || 
                       (user?.parse_permission_expires && new Date(user.parse_permission_expires) < new Date());

  // Use React Query to fetch channel details
  const { 
    data: channel, 
    isLoading, 
    error: queryError,
  } = useQuery({
    queryKey: ['channel', id],
    queryFn: () => channelsAPI.getById(id),
    select: (response) => response.data,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Update filtered members when channel data changes
  useEffect(() => {
    if (channel?.members) {
      setFilteredMembers(channel.members);
    }
  }, [channel]);

  // Update the filter members effect to include new filters
  useEffect(() => {
    if (!channel?.members) return;
    
    let filtered = channel.members;
    
    // Apply premium filter
    if (showOnlyPremium) {
      filtered = filtered.filter(member => member.is_premium);
    }
    
    // Apply username filter
    if (showOnlyWithUsername) {
      filtered = filtered.filter(member => member.username);
    }
    
    // Apply search term filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member => 
        member.username?.toLowerCase().includes(term) ||
        member.first_name?.toLowerCase().includes(term) ||
        member.last_name?.toLowerCase().includes(term)
      );
    }
    
    setFilteredMembers(filtered);
    // Reset to first page when filters change
    setPage(0);
  }, [searchTerm, channel?.members, showOnlyPremium, showOnlyWithUsername]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleBottomNavChange = (event, newValue) => {
    setValue(newValue);
    navigate(newValue);
  };

  const exportToCSV = () => {
    if (!channel?.members) return;

    const csvContent = [
      [t('common.userId', 'User ID'), t('common.username', 'Username'), 
       t('common.firstName', 'First Name'), t('common.lastName', 'Last Name'), 
       t('common.isBot', 'Is Bot'), t('common.isAdmin', 'Is Admin'), 
       t('common.isPremium', 'Is Premium')],
      ...channel.members.map(member => [
        member.user_id,
        member.username || '',
        member.first_name || '',
        member.last_name || '',
        member.is_bot ? t('common.yes', 'Yes') : t('common.no', 'No'),
        member.is_admin ? t('common.yes', 'Yes') : t('common.no', 'No'),
        member.is_premium ? t('common.yes', 'Yes') : t('common.no', 'No')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${channel.group_name}_members.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (queryError) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/channels')}
          sx={{ mb: 3 }}
        >
          {t('common.back')}
        </Button>
        
        <Alert severity="error">
          {t('common.loadChannelError')}
        </Alert>
      </Box>
    );
  }

  if (!channel) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/channels')}
          sx={{ mb: 3 }}
        >
          {t('common.back')}
        </Button>
        
        <Alert severity="warning">
          {t('telegram.channelNotFound')}
        </Alert>
      </Box>
    );
  }

  const bottomNav = (
    <BottomNavigation
      value={location.pathname}
      onChange={handleBottomNavChange}
      showLabels
      sx={{
        width: '100%',
        position: 'fixed',
        bottom: 0,
        borderTop: 1,
        borderColor: 'divider',
        zIndex: (theme) => theme.zIndex.appBar,
        bgcolor: 'background.paper',
      }}
    >
      <BottomNavigationAction
        label={t('navigation.sessions', 'Sessions')}
        value="/"
        icon={<HomeIcon />}
      />
      <BottomNavigationAction
        label={t('navigation.parsedGroups', 'Groups')}
        value="/groups"
        icon={<GroupsIcon />}
      />
      <BottomNavigationAction
        label={t('navigation.parsedChannels', 'Channels')}
        value="/channels"
        icon={<ChannelsIcon />}
      />
      <BottomNavigationAction
        label={t('navigation.profile', 'Profile')}
        value="/profile"
        icon={<PersonIcon />}
      />
    </BottomNavigation>
  );

  return (
    <Container maxWidth="lg" sx={{ pb: isMobile ? 8 : 3 }}>
      <Box>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3,
          backgroundColor: 'background.default',
          py: 1
        }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/channels')}
            variant="outlined"
            size={isMobile ? "small" : "medium"}
            sx={isMobile ? {
              minWidth: 'auto',
              px: 2,
            } : {}}
          >
            {t('common.back')}
          </Button>
          
          <Tooltip title={isInDemoMode ? t('telegram.demoModeChannelDisabled', 'Channel parsing is disabled in demo mode') : ''}>
            <span>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => navigate('/channels', { state: { openParseDialog: true } })}
                size={isMobile ? "small" : "medium"}
                disabled={isInDemoMode}
                sx={isMobile ? {
                  minWidth: 'auto',
                  px: 2,
                  fontSize: '0.875rem',
                  '& .MuiButton-startIcon': {
                    mr: 0.5,
                  },
                } : {}}
              >
                {isMobile ? t('common.newChannel', 'New') : t('telegram.parseNewChannel')}
              </Button>
            </span>
          </Tooltip>
        </Box>
        
        {isInDemoMode && (
          <Alert 
            severity="info" 
            sx={{ 
              mb: 3, 
              '& .MuiAlert-message': { display: 'flex', alignItems: 'center' },
              '& .MuiAlert-icon': { display: 'flex', alignItems: 'center', mt: 0 }
            }}
          >
            {t('telegram.demoModeMessage', 'You are in demo mode. Channel parsing is disabled, but you can parse groups.')}
          </Alert>
        )}
        
        <Paper sx={{ p: isMobile ? 2 : 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: isMobile ? '100%' : 'auto' }}>
              <Typography variant={isMobile ? "h5" : "h4"} component="h1" gutterBottom>
                {channel.group_name}
              </Typography>
              
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {channel.group_username ? `@${channel.group_username}` : t('telegram.privateChannel')}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, flexWrap: 'wrap', gap: 1 }}>
                <Chip 
                  label={`${channel.member_count} ${t('common.members')}`} 
                  color="primary" 
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                />
                <Chip 
                  label={`${channel.members?.length || 0} ${t('common.usersFound')}`} 
                  color="info" 
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                />
                <Chip 
                  label={channel.is_public ? t('common.public') : t('common.private')} 
                  color={channel.is_public ? 'success' : 'default'} 
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                />
              </Box>
            </Box>
            
            <Button
              variant="outlined"
              color="primary"
              size={isMobile ? "small" : "medium"}
              startIcon={<DownloadIcon />}
              onClick={exportToCSV}
              sx={isMobile ? {
                height: 32,
                minWidth: 32,
                '& .MuiButton-startIcon': {
                  margin: 0
                }
              } : {}}
            >
              {isMobile ? "CSV" : t('telegram.exportMembers')}
            </Button>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={t('telegram.searchMembersPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size={isMobile ? "small" : "medium"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyPremium}
                  onChange={(e) => setShowOnlyPremium(e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={t('telegram.onlyPremiumUsers')}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyWithUsername}
                  onChange={(e) => setShowOnlyWithUsername(e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={t('telegram.onlyUsersWithUsername')}
            />
          </Box>
          
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size={isMobile ? "small" : "medium"} sx={{ tableLayout: 'fixed', minWidth: isMobile ? 400 : '100%' }}>
              <TableHead>
                <TableRow>
                  {isMobile ? (
                    <>
                      <TableCell width="8%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>#</TableCell>
                      <TableCell width="30%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>Username</TableCell>
                      <TableCell width="30%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>Name</TableCell>
                      <TableCell width="16%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>Premium</TableCell>
                      <TableCell width="16%" align="right" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>Actions</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell width="5%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#</TableCell>
                      <TableCell width="15%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('common.userId')}</TableCell>
                      <TableCell width="15%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Username</TableCell>
                      <TableCell width="20%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Name</TableCell>
                      <TableCell width="15%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Status</TableCell>
                      <TableCell width="20%" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Premium</TableCell>
                      <TableCell width="10%" align="right" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t('common.actions')}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMembers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((member, index) => (
                    <TableRow key={member.user_id}>
                      {isMobile ? (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>
                            {page * rowsPerPage + index + 1}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>
                            {member.username ? (
                              <Box
                                component="a"
                                href={`https://t.me/${member.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{
                                  color: '#2AABEE',
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline'
                                  }
                                }}
                              >
                                @{member.username}
                              </Box>
                            ) : '-'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>
                            {[member.first_name, member.last_name].filter(Boolean).join(' ') || '-'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px', color: '#fff' }}>
                            {member.is_premium ? (
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <VerifiedIcon sx={{ fontSize: 16, color: '#f57c00' }} />
                              </Box>
                            ) : '-'}
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', padding: '6px 2px' }}>
                            <IconButton
                              size="small"
                              href={`https://t.me/${member.username || member.user_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: '#2AABEE' }}
                            >
                              <TelegramIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{page * rowsPerPage + index + 1}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.user_id}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {member.username ? `@${member.username}` : '-'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {[member.first_name, member.last_name].filter(Boolean).join(' ') || '-'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {member.is_admin && (
                                <Tooltip title={t('common.isAdmin')}>
                                  <AdminIcon color="primary" />
                                </Tooltip>
                              )}
                              {member.is_bot ? (
                                <Tooltip title={t('common.isBot')}>
                                  <BotIcon color="secondary" />
                                </Tooltip>
                              ) : !member.is_admin && (
                                <Tooltip title={t('common.user')}>
                                  <PersonIcon color="action" />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {member.is_premium ? (
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  bgcolor: 'transparent',
                                  color: '#f57c00',
                                  border: '1px solid #f57c00',
                                  borderRadius: '16px',
                                  padding: '3px 8px',
                                  fontSize: '0.8125rem',
                                  fontWeight: 500,
                                  width: 'fit-content'
                                }}
                              >
                                <VerifiedIcon sx={{ fontSize: 16, mr: 0.5, color: '#f57c00' }} />
                                Premium
                              </Box>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              href={`https://t.me/${member.username || member.user_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ color: '#2AABEE' }}
                            >
                              <TelegramIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            component="div"
            count={filteredMembers.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage={isMobile ? '' : t('common.rowsPerPage')}
          />
        </Paper>
      </Box>
      {isMobile && bottomNav}
    </Container>
  );
};

export default ChannelDetails; 