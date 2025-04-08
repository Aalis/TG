import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  IconButton,
  FormControlLabel,
  Switch,
  Container,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  SmartToy as BotIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  Verified as VerifiedIcon,
  Add as AddIcon,
  Telegram as TelegramIcon,
  Home as HomeIcon,
  Group as GroupsIcon,
  Forum as ChannelsIcon,
} from '@mui/icons-material';
import { groupsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useGroupDetails } from '../hooks/useGroupDetails';

const GroupDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Use React Query hook instead of manual fetching
  const { 
    group, 
    isLoading, 
    isError, 
    error: queryError, 
    refetch 
  } = useGroupDetails(id);
  
  // Local state for UI
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPremium, setShowOnlyPremium] = useState(false);
  const [showOnlyWithUsername, setShowOnlyWithUsername] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [value, setValue] = useState(location.pathname);

  // Set initial filtered members when group data changes
  useEffect(() => {
    if (group && group.members) {
      setFilteredMembers(group.members);
    }
  }, [group]);

  // Use memo to calculate filtered members based on filters
  const calculateFilteredMembers = useMemo(() => {
    if (!group || !group.members) return [];
    
    let filtered = [...group.members];
    
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
      filtered = filtered.filter(
        (member) =>
          (member.username && member.username.toLowerCase().includes(term)) ||
          (member.first_name && member.first_name.toLowerCase().includes(term)) ||
          (member.last_name && member.last_name.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [group, searchTerm, showOnlyPremium, showOnlyWithUsername]);
  
  // Update filtered members whenever calculation changes
  useEffect(() => {
    setFilteredMembers(calculateFilteredMembers);
    // Reset to first page when filtering
    setPage(0);
  }, [calculateFilteredMembers]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const exportToCSV = () => {
    if (!group) return;
    
    // Create CSV content
    const headers = [
      t('common.userId', 'User ID'), 
      t('common.username', 'Username'), 
      t('common.firstName', 'First Name'), 
      t('common.lastName', 'Last Name'), 
      t('common.isBot', 'Is Bot'), 
      t('common.isAdmin', 'Is Admin'), 
      t('common.isPremium', 'Is Premium')
    ];
    const csvContent = [
      headers.join(','),
      ...filteredMembers.map(member => [
        member.user_id,
        member.username || '',
        member.first_name || '',
        member.last_name || '',
        member.is_bot ? t('common.yes', 'Yes') : t('common.no', 'No'),
        member.is_admin ? t('common.yes', 'Yes') : t('common.no', 'No'),
        member.is_premium ? t('common.yes', 'Yes') : t('common.no', 'No')
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${group.group_name}_filtered_members.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/groups')}
          sx={{ mb: 3 }}
          size={isMobile ? "small" : "medium"}
        >
          {t('common.back')}
        </Button>
        
        <Alert severity="error">
          {queryError?.message || t('common.loadGroupError', 'Failed to load group details. Please try again.')}
        </Alert>
      </Box>
    );
  }

  if (!group) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/groups')}
          sx={{ mb: 3 }}
          size={isMobile ? "small" : "medium"}
        >
          {t('common.back')}
        </Button>
        
        <Alert severity="warning">
          {t('telegram.groupNotFound')}
        </Alert>
      </Box>
    );
  }

  const handleBottomNavChange = (event, newValue) => {
    setValue(newValue);
    navigate(newValue);
  };

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
            onClick={() => navigate('/groups')}
            variant="outlined"
            size={isMobile ? "small" : "medium"}
            sx={isMobile ? {
              minWidth: 'auto',
              px: 2,
            } : {}}
          >
            {t('common.back')}
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => navigate('/groups', { state: { openParseDialog: true } })}
            size={isMobile ? "small" : "medium"}
            sx={isMobile ? {
              minWidth: 'auto',
              px: 2,
              fontSize: '0.875rem',
              '& .MuiButton-startIcon': {
                mr: 0.5,
              },
            } : {}}
          >
            {isMobile ? t('common.newGroup', 'New') : t('telegram.parseNewGroup')}
          </Button>
        </Box>
        
        <Paper sx={{ p: isMobile ? 2 : 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: isMobile ? '100%' : 'auto' }}>
              <Typography variant={isMobile ? "h5" : "h4"} component="h1" gutterBottom>
                {group.group_name}
              </Typography>
              
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {group.group_username ? `@${group.group_username}` : t('telegram.privateGroup')}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, flexWrap: 'wrap', gap: 1 }}>
                <Chip 
                  label={`${group.member_count} ${t('common.members')}`} 
                  color="primary" 
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                />
                <Chip 
                  label={`${group.members?.length || 0} ${t('common.usersFound')}`} 
                  color="info" 
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                />
                <Chip 
                  label={group.is_public ? t('common.public') : t('common.private')} 
                  color={group.is_public ? 'success' : 'default'} 
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

export default GroupDetails; 