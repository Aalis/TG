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
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { groupsAPI } from '../services/api';

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
  const [parsingStatus, setParsingStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });
  const navigate = useNavigate();

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

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await groupsAPI.getAll();
      setGroups(response.data);
      setFilteredGroups(response.data);
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

  const handleParseGroup = async () => {
    if (!groupLink.trim()) {
      setParsingStatus({
        loading: false,
        success: false,
        error: 'Please enter a group link',
      });
      return;
    }
    
    try {
      setParsingStatus({
        loading: true,
        success: false,
        error: null,
      });
      
      const response = await groupsAPI.parseGroup(groupLink.trim());
      
      if (response.data.success) {
        // Navigate to the group details page
        navigate(`/groups/${response.data.group.id}`);
        
        // Close dialog and reset state
        setParseDialogOpen(false);
        setGroupLink('');
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
      // Extract error message from validation errors or use default message
      const errorMessage = err.response?.data?.detail?.[0]?.msg || 
                          err.response?.data?.detail || 
                          'Failed to parse group. Please try again.';
      
      setParsingStatus({
        loading: false,
        success: false,
        error: errorMessage,
      });
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
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 1 }}>
                    <Chip 
                      label={`${group.member_count} members`} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                    <Chip 
                      label={group.is_public ? 'Public' : 'Private'} 
                      size="small" 
                      color={group.is_public ? 'success' : 'default'} 
                      variant="outlined"
                      sx={{ ml: 1 }}
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
      <Dialog open={parseDialogOpen} onClose={() => !parsingStatus.loading && setParseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Parse New Telegram Group</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Enter a Telegram group link to parse its members. The link should be in the format https://t.me/groupname.
          </Typography>
          
          {parsingStatus.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {parsingStatus.error}
            </Alert>
          )}
          
          {parsingStatus.success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Group parsed successfully!
            </Alert>
          )}
          
          <TextField
            fullWidth
            label="Telegram Group Link"
            placeholder="https://t.me/groupname"
            value={groupLink}
            onChange={(e) => setGroupLink(e.target.value)}
            disabled={parsingStatus.loading}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParseDialogOpen(false)} disabled={parsingStatus.loading}>
            Cancel
          </Button>
          <Button
            onClick={handleParseGroup}
            variant="contained"
            color="primary"
            disabled={parsingStatus.loading || !groupLink.trim()}
            startIcon={parsingStatus.loading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Parse
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParsedGroups; 