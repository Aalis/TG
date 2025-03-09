import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Switch,
  DialogContentText,
  LinearProgress,
  Divider,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { groupsAPI } from '../services/api';
import { useSnackbar } from 'notistack';

const ParsedGroups = () => {
  const [groups, setGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [groupLink, setGroupLink] = useState('');
  const [scanComments, setScanComments] = useState(false);
  const [commentLimit, setCommentLimit] = useState(100);
  const [parsingProgress, setParsingProgress] = useState(null);
  const [progressPolling, setProgressPolling] = useState(null);
  const [availableDialogs, setAvailableDialogs] = useState([]);
  const [loadingDialogs, setLoadingDialogs] = useState(false);
  const [dialogError, setDialogError] = useState(null);
  const [selectedDialog, setSelectedDialog] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  // Fetch groups on component mount
  useEffect(() => {
    fetchGroups();
  }, []);

  // Filter groups when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredGroups(groups);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = groups.filter(
        (group) =>
          group.group_name.toLowerCase().includes(term) ||
          (group.group_username && group.group_username.toLowerCase().includes(term))
      );
      setFilteredGroups(filtered);
    }
  }, [searchTerm, groups]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressPolling) {
        clearInterval(progressPolling);
      }
    };
  }, [progressPolling]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await groupsAPI.getAll();
      // Sort groups by parsed_at in descending order
      const sortedGroups = response.data.sort((a, b) => 
        new Date(b.parsed_at) - new Date(a.parsed_at)
      );
      setGroups(sortedGroups);
      setFilteredGroups(sortedGroups);
      setError(null);
    } catch (err) {
      setError('Failed to load groups. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (group) => {
    setGroupToDelete(group);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await groupsAPI.delete(groupToDelete.id);
      
      // Refresh groups list
      await fetchGroups();
      
      // Close dialog
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete group. Please try again.');
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
        const response = await groupsAPI.getParsingProgress();
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

  const handleParseGroup = async () => {
    if (!groupLink && !selectedDialog) {
      setError('Please enter a group link or select a group from the list');
      return;
    }

    setLoading(true);
    try {
      // Start progress polling before making the parse request
      startProgressPolling();

      const response = await groupsAPI.parseGroup(
        selectedDialog ? selectedDialog.id : groupLink.trim(),
        scanComments,
        scanComments ? commentLimit : 100
      );

      if (response.data.success) {
        // Navigate to the group details page
        navigate(`/groups/${response.data.group.id}`);
        
        // Close dialog and reset state
        setParseDialogOpen(false);
        setGroupLink('');
        setScanComments(false);
        setCommentLimit(100);
        setSelectedDialog(null);
        fetchGroups();
        enqueueSnackbar('Group parsed successfully!', { variant: 'success' });
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail?.[0]?.msg || 
                          err.response?.data?.detail || 
                          'Failed to parse group. Please try again.';
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDialogs = async () => {
    try {
      setLoadingDialogs(true);
      setDialogError(null);
      const response = await groupsAPI.getDialogs();
      setAvailableDialogs(response.data);
    } catch (err) {
      setDialogError('Failed to load available groups. Please check your Telegram session.');
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

  const handleCancelParsing = async () => {
    try {
      setIsCancelling(true);
      await groupsAPI.cancelParsing();
      // The progress polling will automatically stop when the backend reports is_parsing: false
    } catch (err) {
      console.error('Error cancelling parsing:', err);
      enqueueSnackbar('Failed to cancel parsing', { variant: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading && groups.length === 0) {
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
          Parsed Groups
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setParseDialogOpen(true)}
        >
          Parse New Group
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
          placeholder="Search groups by name or username..."
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
      
      {filteredGroups.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          {groups.length === 0 ? (
            <>
              <Typography variant="h6" gutterBottom>
                No Parsed Groups Found
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                You haven't parsed any Telegram groups yet.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setParseDialogOpen(true)}
              >
                Parse Your First Group
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                No Results Found
              </Typography>
              <Typography variant="body1" color="text.secondary">
                No groups match your search criteria.
              </Typography>
            </>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredGroups.map((group) => (
            <Grid item xs={12} sm={6} md={4} key={group.id}>
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
                  navigate(`/groups/${group.id}`);
                }}
              >
                <CardContent>
                  <Typography variant="h6" noWrap gutterBottom>
                    {group.group_name}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {group.group_username ? `@${group.group_username}` : 'Private Group'}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', mt: 1, mb: 1, gap: 1 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Chip 
                        label={`${group.member_count.toLocaleString()} total members`} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`${(group.members?.length || 0).toLocaleString()} users found`} 
                        size="small" 
                        color="info" 
                        variant="outlined"
                      />
                    </Box>
                    <Chip 
                      label={group.is_public ? 'Public' : 'Private'} 
                      size="small" 
                      color={group.is_public ? 'success' : 'default'} 
                      variant="outlined"
                    />
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" display="block">
                    Parsed: {new Date(group.parsed_at).toLocaleString()}
                  </Typography>
                </CardContent>
                
                <CardActions>
                  <Box sx={{ flexGrow: 1 }} />
                  
                  <Tooltip title="Delete">
                    <IconButton 
                      color="error" 
                      onClick={() => handleDeleteClick(group)}
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
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the group "{groupToDelete?.group_name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Parse Group Dialog */}
      <Dialog open={parseDialogOpen} onClose={() => !loading && setParseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Parse New Group</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select a group from your Telegram groups or enter a group link manually.
          </DialogContentText>

          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {dialogError}
            </Alert>
          )}

          {/* Available Groups List */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Your Telegram Groups
            </Typography>
            {loadingDialogs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : availableDialogs.length > 0 ? (
              <Box sx={{ maxHeight: '200px', overflowY: 'auto' }}>
                {availableDialogs
                  .filter(dialog => dialog.type === 'group')
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
                        setGroupLink('');
                        setError(null);
                      }}
                    >
                      <Typography variant="subtitle2">
                        {dialog.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dialog.username ? `@${dialog.username}` : 'Private Group'} • {dialog.members_count} members
                      </Typography>
                    </Box>
                  ))}
              </Box>
            ) : !dialogError && (
              <Typography variant="body2" color="text.secondary">
                No groups found. Make sure you have an active Telegram session.
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom>
            Or Enter Group Link Manually
          </Typography>
          
          <TextField
            margin="dense"
            label="Group Link"
            fullWidth
            variant="outlined"
            value={groupLink}
            onChange={(e) => {
              setGroupLink(e.target.value);
              setSelectedDialog(null);
              setError(null);
            }}
            disabled={loading}
            error={!!error}
            helperText={error}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={scanComments}
                onChange={(e) => setScanComments(e.target.checked)}
                disabled={loading}
              />
            }
            label="Scan comments for additional users"
            sx={{ mb: 2 }}
          />

          {scanComments && (
            <FormControl fullWidth variant="outlined">
              <InputLabel>Comment Scan Limit</InputLabel>
              <Select
                value={commentLimit}
                onChange={(e) => setCommentLimit(e.target.value)}
                label="Comment Scan Limit"
                disabled={loading}
              >
                <MenuItem value={100}>Last 100 Comments</MenuItem>
                <MenuItem value={1000}>Last 1,000 Comments</MenuItem>
                <MenuItem value={5000}>Last 5,000 Comments</MenuItem>
              </Select>
              <FormHelperText>
                Select how many recent comments to scan for additional user information
              </FormHelperText>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setParseDialogOpen(false);
            setSelectedDialog(null);
            setGroupLink('');
            setError(null);
          }} disabled={loading}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleParseGroup}
            loading={loading}
            variant="contained"
          >
            Parse Group
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog 
        open={!!parsingProgress && parsingProgress.is_parsing} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Parsing Group</DialogTitle>
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

export default ParsedGroups; 