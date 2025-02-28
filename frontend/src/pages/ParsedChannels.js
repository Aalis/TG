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

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await channelsAPI.getAll();
      setChannels(response.data);
      setFilteredChannels(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load channels. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
      setParsingStatus({
        loading: true,
        success: false,
        error: null,
      });
      
      const response = await channelsAPI.parseChannel(channelLink.trim());
      
      if (response.data.success) {
        // Refresh channels list
        await fetchChannels();
        
        // Close dialog and reset state
        setParseDialogOpen(false);
        setChannelLink('');
        setParsingStatus({
          loading: false,
          success: true,
          error: null,
        });
      } else {
        setParsingStatus({
          loading: false,
          success: false,
          error: response.data.message,
        });
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail?.[0]?.msg || 
                          err.response?.data?.detail || 
                          'Failed to parse channel. Please try again.';
      
      setParsingStatus({
        loading: false,
        success: false,
        error: errorMessage,
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
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
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
            <Grid item xs={12} key={channel.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" component="h2">
                      {channel.group_name}
                    </Typography>
                    <Chip
                      label={channel.is_public ? 'Public' : 'Private'}
                      color={channel.is_public ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                  
                  {channel.group_username && (
                    <Typography color="text.secondary" gutterBottom>
                      @{channel.group_username}
                    </Typography>
                  )}
                  
                  <Typography variant="body2" color="text.secondary">
                    Parsed at: {format(new Date(channel.parsed_at), 'PPpp')}
                  </Typography>
                </CardContent>
                
                <CardActions>
                  <Button
                    size="small"
                    startIcon={expandedPosts[channel.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => handleExpandPosts(channel.id)}
                    disabled={loadingPosts[channel.id]}
                  >
                    {loadingPosts[channel.id] ? (
                      <CircularProgress size={20} />
                    ) : (
                      `${expandedPosts[channel.id] ? 'Hide' : 'Show'} Posts`
                    )}
                  </Button>
                </CardActions>
                
                <Collapse in={expandedPosts[channel.id]}>
                  <List>
                    {posts[channel.id]?.map((post) => (
                      <ListItem key={post.id} divider>
                        <ListItemText
                          primary={post.message}
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" display="block">
                                Posted: {format(new Date(post.posted_at), 'PPpp')}
                              </Typography>
                              <Typography variant="caption" display="block">
                                Views: {post.views} | Forwards: {post.forwards} | Replies: {post.replies}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => handleExpandComments(post.id)}
                            disabled={loadingComments[post.id]}
                          >
                            {loadingComments[post.id] ? (
                              <CircularProgress size={20} />
                            ) : (
                              <CommentIcon />
                            )}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      <Dialog
        open={parseDialogOpen}
        onClose={() => setParseDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Parse New Channel</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Channel Link"
            type="text"
            fullWidth
            value={channelLink}
            onChange={(e) => setChannelLink(e.target.value)}
            placeholder="https://t.me/channel_name"
            error={!!parsingStatus.error}
            helperText={parsingStatus.error}
            disabled={parsingStatus.loading}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setParseDialogOpen(false)}
            disabled={parsingStatus.loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleParseChannel}
            variant="contained"
            color="primary"
            disabled={parsingStatus.loading}
            startIcon={parsingStatus.loading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Parse Channel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParsedChannels; 