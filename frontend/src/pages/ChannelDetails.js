import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Divider,
  Card,
  CardContent,
  Collapse,
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Comment as CommentIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  SmartToy as BotIcon,
  Send as SendIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { channelsAPI } from '../services/api';

const ChannelDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPremium, setShowOnlyPremium] = useState(false);
  const [showOnlyWithUsername, setShowOnlyWithUsername] = useState(false);
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [expandedPosts, setExpandedPosts] = useState({});
  const [comments, setComments] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch channel details and posts on component mount
  useEffect(() => {
    const fetchChannelDetails = async () => {
      try {
        setLoading(true);
        const channelResponse = await channelsAPI.getAll();
        const channel = channelResponse.data.find(c => c.id === parseInt(id));
        
        if (!channel) {
          setError('Channel not found');
          return;
        }
        
        setChannel(channel);
        
        // Fetch posts
        const postsResponse = await channelsAPI.getPosts(channel.id);
        setPosts(postsResponse.data);
        setFilteredPosts(postsResponse.data);
        
        setFilteredMembers(channel.members || []);
        
      } catch (err) {
        setError('Failed to load channel details. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchChannelDetails();
  }, [id]);

  // Filter posts when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPosts(posts);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = posts.filter(post => 
        post.text?.toLowerCase().includes(term)
      );
      setFilteredPosts(filtered);
    }
  }, [searchTerm, posts]);

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

  const handleExpandPost = async (postId) => {
    setExpandedPosts(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));

    // Load comments if not already loaded
    if (!comments[postId] && !loadingComments[postId]) {
      try {
        setLoadingComments(prev => ({ ...prev, [postId]: true }));
        const response = await channelsAPI.getComments(postId);
        setComments(prev => ({ ...prev, [postId]: response.data }));
      } catch (err) {
        console.error('Failed to load comments:', err);
      } finally {
        setLoadingComments(prev => ({ ...prev, [postId]: false }));
      }
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const exportToCSV = () => {
    if (!channel?.members) return;

    const csvContent = [
      ['User ID', 'Username', 'First Name', 'Last Name', 'Is Bot', 'Is Admin', 'Is Premium'],
      ...channel.members.map(member => [
        member.user_id,
        member.username || '',
        member.first_name || '',
        member.last_name || '',
        member.is_bot ? 'Yes' : 'No',
        member.is_admin ? 'Yes' : 'No',
        member.is_premium ? 'Yes' : 'No'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `channel_${channel.group_name}_members.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the URL object
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
          onClick={() => navigate('/channels')}
          sx={{ mb: 3 }}
        >
          Back to Channels
        </Button>
        
        <Alert severity="error">
          {error}
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
          Back to Channels
        </Button>
        
        <Alert severity="warning">
          Channel not found.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/channels')}
        sx={{ mb: 3 }}
      >
        Back to Channels
      </Button>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {channel.group_name}
            </Typography>
            
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {channel.group_username ? `@${channel.group_username}` : 'Private Channel'}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Chip 
                label={`${channel.member_count} subscribers`} 
                color="primary" 
                variant="outlined"
              />
              <Chip 
                label={channel.is_public ? 'Public' : 'Private'} 
                color={channel.is_public ? 'success' : 'default'} 
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
                Only Premium Users
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
                Only Users with Username
              </Box>
            }
          />
        </Box>

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
          <Table sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell width="60px" sx={{ minWidth: '60px', height: '56px', padding: '12px' }}>#</TableCell>
                <TableCell width="120px" sx={{ minWidth: '120px', height: '56px', padding: '12px' }}>User ID</TableCell>
                <TableCell width="150px" sx={{ minWidth: '150px', height: '56px', padding: '12px' }}>Username</TableCell>
                <TableCell width="200px" sx={{ minWidth: '200px', height: '56px', padding: '12px' }}>Name</TableCell>
                <TableCell width="120px" sx={{ minWidth: '120px', height: '56px', padding: '12px' }}>Status</TableCell>
                <TableCell width="120px" sx={{ minWidth: '120px', height: '56px', padding: '12px' }} align="center">Premium</TableCell>
                <TableCell width="100px" sx={{ minWidth: '100px', height: '56px', padding: '12px' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMembers
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((member, index) => (
                  <TableRow key={member.user_id} sx={{ height: '56px' }}>
                    <TableCell sx={{ width: '60px', height: '56px', padding: '12px' }}>
                      {page * rowsPerPage + index + 1}
                    </TableCell>
                    <TableCell sx={{ width: '120px', height: '56px', padding: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.user_id}
                    </TableCell>
                    <TableCell sx={{ width: '150px', height: '56px', padding: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.username ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography noWrap>@{member.username}</Typography>
                        </Box>
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
                          <SendIcon sx={{ fontSize: '20px' }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
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

export default ChannelDetails; 