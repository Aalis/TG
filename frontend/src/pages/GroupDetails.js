import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from '@mui/icons-material';
import { groupsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import ParseButtonHeader from '../components/ParseButtonHeader';
import { useGroupDetails } from '../hooks/useGroupDetails';

const GroupDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  
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
  const [showBots, setShowBots] = useState(true);

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
        >
          {t('common.back')}
        </Button>
        
        <Alert severity="warning">
          {t('telegram.groupNotFound')}
        </Alert>
      </Box>
    );
  }

  return (
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
          size="medium"
        >
          {t('common.back')}
        </Button>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/groups', { state: { openParseDialog: true } })}
          size="medium"
        >
          {t('telegram.parseNewGroup')}
        </Button>
      </Box>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {group.group_name}
            </Typography>
            
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {group.group_username ? `@${group.group_username}` : t('telegram.privateGroup')}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Chip 
                label={`${group.member_count} ${t('common.members')}`} 
                color="primary" 
                variant="outlined"
              />
              <Chip 
                label={`${group.members?.length || 0} ${t('common.usersFound')}`} 
                color="info" 
                variant="outlined"
                sx={{ ml: 1 }}
              />
              <Chip 
                label={group.is_public ? t('common.public') : t('common.private')} 
                color={group.is_public ? 'success' : 'default'} 
                variant="outlined"
                sx={{ ml: 1 }}
              />
            </Box>
          </Box>
          
          <Button
            variant="outlined"
            color="primary"
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
          >
            {t('telegram.exportMembers')}
          </Button>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showOnlyPremium}
                onChange={(e) => setShowOnlyPremium(e.target.checked)}
                color="warning"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VerifiedIcon color="warning" sx={{ fontSize: '20px' }} />
                {t('telegram.onlyPremiumUsers', 'Premium Users')}
              </Box>
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={showOnlyWithUsername}
                onChange={(e) => setShowOnlyWithUsername(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography>@</Typography>
                {t('telegram.onlyUsersWithUsername', 'Users with Username')}
              </Box>
            }
          />
        </Box>

        <TextField
          fullWidth
          placeholder={t('telegram.searchMembersPlaceholder', 'Search members by username or name...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
        
        <Typography variant="h6" gutterBottom>
          {t('navigation.members')}
        </Typography>
        
        <TableContainer>
          <Table sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell width="60px" sx={{ minWidth: '60px', height: '56px', padding: '12px' }}>#</TableCell>
                <TableCell width="120px" sx={{ minWidth: '120px', height: '56px', padding: '12px' }}>User ID</TableCell>
                <TableCell width="150px" sx={{ minWidth: '150px', height: '56px', padding: '12px' }}>Username</TableCell>
                <TableCell width="200px" sx={{ minWidth: '200px', height: '56px', padding: '12px' }}>Name</TableCell>
                <TableCell width="120px" sx={{ minWidth: '120px', height: '56px', padding: '12px' }}>Status</TableCell>
                <TableCell width="120px" sx={{ minWidth: '120px', height: '56px', padding: '12px' }} align="center">Premium</TableCell>
                <TableCell width="100px" sx={{ minWidth: '100px', height: '56px', padding: '12px' }} align="center">Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMembers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((member, index) => (
                  <TableRow 
                    key={member.user_id}
                    sx={{ height: '56px' }}
                  >
                    <TableCell sx={{ width: '60px', height: '56px', padding: '12px' }}>
                      {page * rowsPerPage + index + 1}
                    </TableCell>
                    <TableCell sx={{ width: '120px', height: '56px', padding: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.user_id}
                    </TableCell>
                    <TableCell sx={{ width: '150px', height: '56px', padding: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.username ? (
                        <Tooltip title="Open in Telegram" placement="top">
                          <a
                            href={`https://t.me/${member.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none', color: 'inherit', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            @{member.username}
                          </a>
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ width: '200px', height: '56px', padding: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[member.first_name, member.last_name].filter(Boolean).join(' ') || '-'}
                    </TableCell>
                    <TableCell sx={{ width: '120px', height: '56px', padding: '12px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {member.is_admin && (
                          <Tooltip title="Admin">
                            <AdminIcon color="primary" />
                          </Tooltip>
                        )}
                        {member.is_bot ? (
                          <Tooltip title="Bot">
                            <BotIcon color="secondary" />
                          </Tooltip>
                        ) : !member.is_admin && (
                          <Tooltip title="User">
                            <PersonIcon color="action" />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: '120px', height: '56px', padding: '12px' }} align="center">
                      {member.is_premium ? (
                        <Tooltip title="Premium User" placement="top">
                          <Chip
                            icon={<VerifiedIcon />}
                            label="Premium"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ maxWidth: '100px', height: '24px' }}
                          />
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ width: '100px', height: '56px', padding: '12px' }} align="center">
                      <Tooltip title="Send Message" placement="top">
                        <IconButton
                          color="primary"
                          size="small"
                          component="a"
                          href={member.username ? 
                            `https://t.me/${member.username}` : 
                            `https://web.telegram.org/a/#/profile/${member.user_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ width: '32px', height: '32px' }}
                        >
                          <TelegramIcon sx={{ fontSize: '20px' }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              
              {filteredMembers.length === 0 && (
                <TableRow sx={{ height: '56px' }}>
                  <TableCell colSpan={6} align="center" sx={{ height: '56px', padding: '12px' }}>
                    <Typography variant="body1">
                      No members found matching your search.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredMembers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

export default GroupDetails; 