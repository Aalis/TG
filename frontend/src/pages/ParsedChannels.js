import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  DialogContentText,
  Divider,
  Pagination,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
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
import { useSnackbar } from 'notistack';

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
  const [availableDialogs, setAvailableDialogs] = useState([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [dialogError, setDialogError] = useState(null);
  const [selectedDialog, setSelectedDialog] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Pagination states
  const ITEMS_PER_PAGE = 21;
  const MAX_TOTAL_ITEMS = 42;
  
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  // Get page from URL query parameter or default to 1
  const getPageFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) : 1;
  };

  // Initialize page from URL on component mount
  const [page, setPage] = useState(getPageFromUrl());
  const [paginatedChannels, setPaginatedChannels] = useState([]);
  
  // Sync URL with page state when page changes
  const updateUrlWithPage = (newPage) => {
    const searchParams = new URLSearchParams(location.search);
    
    if (newPage === 1) {
      searchParams.delete('page');
    } else {
      searchParams.set('page', newPage.toString());
    }
    
    const newSearch = searchParams.toString();
    const newPath = location.pathname + (newSearch ? `?${newSearch}` : '');
    
    // Use push instead of replace to maintain browser history for back button
    navigate(newPath, { replace: false });
  };

  // Handle page change from pagination component
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    updateUrlWithPage(newPage);
    window.scrollTo(0, 0);
  };

  // Sync page state with URL when URL changes (e.g., back button)
  useEffect(() => {
    const urlPage = getPageFromUrl();
    if (page !== urlPage) {
      setPage(urlPage);
    }
  }, [location.search]);

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
    // Reset to first page when search changes
    if (page !== 1) {
      setPage(1);
      updateUrlWithPage(1);
    }
  }, [searchTerm, channels]);

  // Update paginated channels when filtered channels or page changes
  useEffect(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setPaginatedChannels(filteredChannels.slice(startIndex, endIndex));
  }, [filteredChannels, page]);

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

  const fetchAvailableDialogs = async () => {
    try {
      setLoadingDialogs(true);
      setDialogError(null);
      const response = await channelsAPI.getDialogs();
      setAvailableDialogs(response.data);
    } catch (err) {
      setDialogError('Failed to load available channels. Please check your Telegram session.');
      console.error(err);
    } finally {
      setLoadingDialogs(false);
    }
  };

  // Fetch available dialogs when parse dialog opens
  useEffect(() => {
    if (parseDialogOpen) {
      fetchAvailableDialogs();
    }
  }, [parseDialogOpen]);

  const handleParseChannel = async () => {
    if (!channelLink && !selectedDialog) {
      setParsingStatus({
        loading: false,
        success: false,
        error: 'Please enter a channel link or select a channel from the list',
      });
      return;
    }

    try {
      setParsingStatus({ loading: true, success: false, error: null });
      
      // Start progress polling before making the parse request
      startProgressPolling();

      // Check if we need to delete the oldest channel
      if (channels.length >= MAX_TOTAL_ITEMS) {
        // Sort by parsed_at in ascending order to get the oldest
        const sortedChannels = [...channels].sort((a, b) => 
          new Date(a.parsed_at) - new Date(b.parsed_at)
        );
        const oldestChannel = sortedChannels[0];
        
        // Delete the oldest channel
        await channelsAPI.deleteChannel(oldestChannel.id);
        enqueueSnackbar(`Oldest channel "${oldestChannel.group_name}" was automatically deleted to maintain the limit of ${MAX_TOTAL_ITEMS} channels`, { 
          variant: 'info',
          autoHideDuration: 5000
        });
      }

      await channelsAPI.parseChannel(
        selectedDialog ? selectedDialog.id : channelLink.trim(),
        postLimit
      );
      
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
      setSelectedDialog(null);
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

  const handleCancelParsing = async () => {
    try {
      setIsCancelling(true);
      await channelsAPI.cancelParsing();
      // The progress polling will automatically stop when the backend reports is_parsing: false
    } catch (err) {
      console.error('Error cancelling parsing:', err);
      enqueueSnackbar('Failed to cancel parsing', { variant: 'error' });
    } finally {
      setIsCancelling(false);
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
        <>
          <Grid container spacing={3}>
            {paginatedChannels.map((channel) => (
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
                    
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', mt: 1, mb: 1, gap: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Chip 
                          label={`${channel.member_count.toLocaleString()} subscribers`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                        <Chip 
                          label={`${(channel.members?.length || 0).toLocaleString()} users found`} 
                          size="small" 
                          color="info" 
                          variant="outlined"
                        />
                      </Box>
                      <Chip 
                        label={channel.is_public ? 'Public' : 'Private'} 
                        size="small" 
                        color={channel.is_public ? 'success' : 'default'} 
                        variant="outlined"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(channel);
                        }}
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
          
          {/* Pagination */}
          {filteredChannels.length > ITEMS_PER_PAGE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
              <Pagination 
                count={Math.ceil(filteredChannels.length / ITEMS_PER_PAGE)} 
                page={page} 
                onChange={handlePageChange}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}

      {/* Parse Channel Dialog */}
      <Dialog open={parseDialogOpen} onClose={() => setParseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Parse New Channel</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select a channel from your Telegram channels or enter a channel link manually.
          </DialogContentText>

          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {dialogError}
            </Alert>
          )}

          {/* Available Channels List */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Your Telegram Channels
            </Typography>
            {loadingDialogs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) :
              <Box sx={{ maxHeight: '200px', overflowY: 'auto' }}>
                {availableDialogs
                  .filter(dialog => dialog.type === 'channel')
                  .map((dialog) => (
                    <Box
                      key={dialog.id}
                      sx={{
                        p: 1,
                        mb: 1,
                        border: '1px solid',
                        borderColor: selectedDialog?.id === dialog.id ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                      onClick={() => {
                        setSelectedDialog(dialog);
                        setChannelLink('');
                        setParsingStatus(prev => ({ ...prev, error: null }));
                      }}
                    >
                      <Typography variant="subtitle2">
                        {dialog.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dialog.username ? `@${dialog.username}` : 'Private Channel'} • {dialog.members_count} subscribers
                      </Typography>
                    </Box>
                  ))}
              </Box>
            }
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom>
            Or Enter Channel Link Manually
          </Typography>
          <TextField
            fullWidth
            label="Channel Link"
            placeholder="https://t.me/channelname"
            value={channelLink}
            onChange={(e) => {
              setChannelLink(e.target.value);
              setSelectedDialog(null);
              setParsingStatus(prev => ({ ...prev, error: null }));
            }}
            margin="normal"
            variant="outlined"
            disabled={parsingStatus.loading}
          />
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Options
            </Typography>
            <TextField
              label="Post Limit"
              type="number"
              value={postLimit}
              onChange={(e) => setPostLimit(Math.max(1, parseInt(e.target.value) || 1))}
              InputProps={{ inputProps: { min: 1 } }}
              size="small"
              disabled={parsingStatus.loading}
              helperText="Maximum number of posts to parse"
            />
          </Box>

          {parsingStatus.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {parsingStatus.error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setParseDialogOpen(false);
            setSelectedDialog(null);
            setChannelLink('');
            setParsingStatus({ loading: false, success: false, error: null });
          }} disabled={parsingStatus.loading}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleParseChannel}
            loading={parsingStatus.loading}
            variant="contained"
          >
            Parse Channel
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
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
            {parsingProgress?.total_posts > 0 && (
              <Typography variant="body2" color="text.secondary">
                Posts: {parsingProgress.current_posts} / {parsingProgress.total_posts}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <LoadingButton
            onClick={handleCancelParsing}
            loading={isCancelling}
            color="error"
            variant="contained"
          >
            Cancel Parsing
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParsedChannels; 