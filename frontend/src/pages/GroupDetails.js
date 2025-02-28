import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  SmartToy as BotIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { groupsAPI } from '../services/api';

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch group details on component mount
  useEffect(() => {
    const fetchGroupDetails = async () => {
      try {
        setLoading(true);
        const response = await groupsAPI.getById(id);
        setGroup(response.data);
        setFilteredMembers(response.data.members);
        setError(null);
      } catch (err) {
        setError('Failed to load group details. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGroupDetails();
  }, [id]);

  // Filter members when search term changes
  useEffect(() => {
    if (!group) return;
    
    if (searchTerm.trim() === '') {
      setFilteredMembers(group.members);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = group.members.filter(
        (member) =>
          (member.username && member.username.toLowerCase().includes(term)) ||
          (member.first_name && member.first_name.toLowerCase().includes(term)) ||
          (member.last_name && member.last_name.toLowerCase().includes(term))
      );
      setFilteredMembers(filtered);
    }
    
    // Reset to first page when filtering
    setPage(0);
  }, [searchTerm, group]);

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
    const headers = ['User ID', 'Username', 'First Name', 'Last Name', 'Is Bot', 'Is Admin'];
    const csvContent = [
      headers.join(','),
      ...group.members.map(member => [
        member.user_id,
        member.username || '',
        member.first_name || '',
        member.last_name || '',
        member.is_bot ? 'Yes' : 'No',
        member.is_admin ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${group.group_name}_members.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/groups')}
          sx={{ mb: 3 }}
        >
          Back to Groups
        </Button>
        
        <Alert severity="error">
          {error}
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
          Back to Groups
        </Button>
        
        <Alert severity="warning">
          Group not found.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/groups')}
        sx={{ mb: 3 }}
      >
        Back to Groups
      </Button>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {group.group_name}
            </Typography>
            
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {group.group_username ? `@${group.group_username}` : 'Private Group'}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Chip 
                label={`${group.member_count} members`} 
                color="primary" 
                variant="outlined"
              />
              <Chip 
                label={group.is_public ? 'Public' : 'Private'} 
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
            Export to CSV
          </Button>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom>
          Members
        </Typography>
        
        <TextField
          fullWidth
          placeholder="Search members by username or name..."
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
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="center">Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMembers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: member.is_admin ? 'primary.main' : (member.is_bot ? 'warning.main' : 'grey.500') }}>
                          {member.is_admin ? <AdminIcon /> : (member.is_bot ? <BotIcon /> : <PersonIcon />)}
                        </Avatar>
                        <Typography variant="body2">
                          {member.username ? `@${member.username}` : (member.first_name || 'Unknown User')}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{member.user_id}</TableCell>
                    <TableCell>{member.username || '-'}</TableCell>
                    <TableCell>
                      {member.first_name && member.last_name
                        ? `${member.first_name} ${member.last_name}`
                        : member.first_name || member.last_name || '-'}
                    </TableCell>
                    <TableCell align="center">
                      {member.is_admin && (
                        <Tooltip title="Admin">
                          <Chip
                            icon={<AdminIcon />}
                            label="Admin"
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                      {member.is_bot && (
                        <Tooltip title="Bot">
                          <Chip
                            icon={<BotIcon />}
                            label="Bot"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                      {!member.is_admin && !member.is_bot && (
                        <Tooltip title="Member">
                          <Chip
                            icon={<PersonIcon />}
                            label="Member"
                            size="small"
                            variant="outlined"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              
              {filteredMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body1" sx={{ py: 2 }}>
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