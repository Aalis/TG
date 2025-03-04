import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Send as SendIcon,
  Comment as CommentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { channelsAPI } from '../services/api';

const ParsedChannels = () => {
  const [channels, setChannels] = useState([]);
  const [filteredChannels, setFilteredChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [channelLink, setChannelLink] = useState('');
  const [postLimit, setPostLimit] = useState(100);
  const [parsingStatus, setParsingStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });
  const [expandedPosts, setExpandedPosts] = useState({});
  const [posts, setPosts] = useState({});
  const [comments, setComments] = useState({});
  const [loadingPosts, setLoadingPosts] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [parsingProgress, setParsingProgress] = useState(null);
  const [progressPolling, setProgressPolling] = useState(null);
  
  const navigate = useNavigate();

  // Fetch channels on component mount
  useEffect(() => {
    fetchChannels();
  }, []);

  // Filter channels when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredChannels(channels);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = channels.filter(
        (channel) =>
          channel.group_name.toLowerCase().includes(term) ||
          (channel.group_username && channel.group_username.toLowerCase().includes(term))
      );
      setFilteredChannels(filtered);
    }
  }, [searchTerm, channels]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressPolling) {
        clearInterval(progressPolling);
      }
    };
  }, [progressPolling]);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await channelsAPI.getAll();
      // Sort channels by parsed_at in descending order
      const sortedChannels = response.data.sort((a, b) => 
        new Date(b.parsed_at) - new Date(a.parsed_at)
      );
      setChannels(sortedChannels);
      setFilteredChannels(sortedChannels);
      setError(null);
    } catch (err) {
      setError('Failed to load channels. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startProgressPolling = () => {
    // Stop any existing polling
    if (progressPolling) {
      clearInterval(progressPolling);
    }

    // Start new polling
    const pollInterval = setInterval(async () => {
      try {
        const response = await channelsAPI.getParsingProgress();
        setParsingProgress(response.data);
        
        // Stop polling if parsing is complete or errored
        if (!response.data.is_parsing) {
          clearInterval(pollInterval);
          setProgressPolling(null);
          setParsingProgress(null);
        }
      } catch (err) {
        console.error('Error fetching parsing progress:', err);
      }
    }, 1000); // Poll every second

    setProgressPolling(pollInterval);
  };

  const handleParseChannel = async () => {
    if (!channelLink.trim()) {
      setParsingStatus({
        loading: false,
        success: false,
        error: 'Please enter a channel link',
      });
      return;
    }

    try {
      setParsingStatus({ loading: true, success: false, error: null });
      
      // Start progress polling before making the parse request
      startProgressPolling();

      await channelsAPI.parseChannel(channelLink, postLimit);
      
      setParsingStatus({
        loading: false,
        success: true,
        error: null,
      });
      
      // Refresh the channels list
      await fetchChannels();
      
      // Close the dialog and reset form
      setParseDialogOpen(false);
      setChannelLink('');
      setPostLimit(100);
    } catch (err) {
      setParsingStatus({
        loading: false,
        success: false,
        error: err.response?.data?.detail || 'Failed to parse channel',
      });
    }
  };

  const handleExpandPosts = async (channelId) => {
    if (expandedPosts[channelId]) {
      setExpandedPosts({ ...expandedPosts, [channelId]: false });
      return;
    }

    try {
      setLoadingPosts({ ...loadingPosts, [channelId]: true });
      const response = await channelsAPI.getPosts(channelId);
      setPosts({ ...posts, [channelId]: response.data });
      setExpandedPosts({ ...expandedPosts, [channelId]: true });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPosts({ ...loadingPosts, [channelId]: false });
    }
  };

  const handleExpandComments = async (postId) => {
    if (comments[postId]) {
      return;
    }

    try {
      setLoadingComments({ ...loadingComments, [postId]: true });
      const response = await channelsAPI.getComments(postId);
      setComments({ ...comments, [postId]: response.data });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments({ ...loadingComments, [postId]: false });
    }
  };

  const handleDeleteClick = (channel) => {
    setSelectedChannelId(channel.id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedChannelId) return;

    try {
      await channelsAPI.deleteChannel(selectedChannelId);
      await fetchChannels();
      setDeleteConfirmOpen(false);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Failed to delete channel', err);
      setError('Failed to delete channel. Please try again.');
    }
  };

  if (loading && channels.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Parsed Channels
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setParseDialogOpen(true)}
        >
          Parse New Channel
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search channels by name or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>
      
      {filteredChannels.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          {channels.length === 0 ? (
            <>
              <Typography variant="h6" gutterBottom>
                No Parsed Channels Found
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                You haven't parsed any Telegram channels yet.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setParseDialogOpen(true)}
              >
                Parse Your First Channel
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                No Results Found
              </Typography>
              <Typography variant="body1" color="text.secondary">
                No channels match your search criteria.
              </Typography>
            </>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredChannels.map((channel) => (
            <Grid item xs={12} sm={6} md={4} key={channel.id}>
              <Card 
                className="card-hover"
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    transition: 'transform 0.2s ease-in-out',
                  }
                }}
                onClick={(e) => {
                  // Prevent navigation if clicking delete button
                  if (e.target.closest('button[data-delete]')) return;
                  navigate(`/channels/${channel.id}`);
                }}
              >
                <CardContent>
                  <Typography variant="h6" noWrap gutterBottom>
                    {channel.group_name}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {channel.group_username ? `@${channel.group_username}` : 'Private Channel'}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                    <Chip 
                      label={`${channel.member_count} subscribers`} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                    <Chip 
                      label={channel.is_public ? 'Public' : 'Private'} 
                      size="small" 
                      color={channel.is_public ? 'success' : 'default'} 
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" display="block">
                    Parsed: {new Date(channel.parsed_at).toLocaleString()}
                  </Typography>
                </CardContent>
                
                <CardActions>
                  <Box sx={{ flexGrow: 1 }} />
                  
                  <Tooltip title="Delete">
                    <IconButton 
                      color="error" 
                      onClick={() => handleDeleteClick(channel)}
                      data-delete="true"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Parse Channel Dialog */}
      <Dialog open={parseDialogOpen} onClose={() => setParseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Parse New Channel</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Channel Link"
            placeholder="Enter channel link or username"
            value={channelLink}
            onChange={(e) => setChannelLink(e.target.value)}
            margin="normal"
            variant="outlined"
            disabled={parsingStatus.loading}
          />
          <TextField
            fullWidth
            label="Post Limit"
            type="number"
            value={postLimit}
            onChange={(e) => setPostLimit(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            margin="normal"
            variant="outlined"
            disabled={parsingStatus.loading}
            helperText="Maximum 100 posts"
          />
          {parsingStatus.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {parsingStatus.error}
            </Alert>
          )}
          {parsingStatus.success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Channel parsed successfully!
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParseDialogOpen(false)} disabled={parsingStatus.loading}>
            Cancel
          </Button>
          <Button
            onClick={handleParseChannel}
            variant="contained"
            color="primary"
            disabled={parsingStatus.loading}
            startIcon={parsingStatus.loading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            {parsingStatus.loading ? 'Parsing...' : 'Parse Channel'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog 
        open={!!parsingProgress && parsingProgress.is_parsing} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Parsing Channel</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="body1" gutterBottom>
              {parsingProgress?.message || 'Initializing...'}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={parsingProgress?.progress || 0}
              sx={{ my: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              Phase: {parsingProgress?.phase || 'initializing'}
            </Typography>
            {parsingProgress?.total_members > 0 && (
              <Typography variant="body2" color="text.secondary">
                Members: {parsingProgress.current_members} / {parsingProgress.total_members}
              </Typography>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Channel</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this channel? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParsedChannels; 