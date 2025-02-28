import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  VpnKey as TokenIcon,
  Group as GroupIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { tokensAPI, groupsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [tokens, setTokens] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupLink, setGroupLink] = useState('');
  const [parsingStatus, setParsingStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch tokens and groups in parallel
        const [tokensResponse, groupsResponse] = await Promise.all([
          tokensAPI.getAll(),
          groupsAPI.getAll(),
        ]);
        
        setTokens(tokensResponse.data);
        setGroups(groupsResponse.data);
        setError(null);
      } catch (err) {
        setError('Failed to load dashboard data. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleParseGroup = async (e) => {
    e.preventDefault();
    
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
      
      const response = await groupsAPI.parseGroup(groupLink);
      
      if (response.data.success) {
        setParsingStatus({
          loading: false,
          success: true,
          error: null,
        });
        
        // Refresh groups list
        const groupsResponse = await groupsAPI.getAll();
        setGroups(groupsResponse.data);
        
        // Clear input
        setGroupLink('');
      } else {
        setParsingStatus({
          loading: false,
          success: false,
          error: response.data.message,
        });
      }
    } catch (err) {
      setParsingStatus({
        loading: false,
        success: false,
        error: err.response?.data?.detail || 'Failed to parse group. Please try again.',
      });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome, {user?.username}!
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Stats Cards */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TokenIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Telegram Tokens</Typography>
              </Box>
              <Typography variant="h3" color="primary">
                {tokens.length}
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                to="/tokens" 
                size="small" 
                color="primary"
              >
                Manage Tokens
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <GroupIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Parsed Groups</Typography>
              </Box>
              <Typography variant="h3" color="primary">
                {groups.length}
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                component={RouterLink} 
                to="/groups" 
                size="small" 
                color="primary"
              >
                View Groups
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        {/* Quick Parse Form */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Parse
            </Typography>
            
            <Divider sx={{ mb: 3 }} />
            
            {tokens.length === 0 ? (
              <Alert severity="warning">
                You need to add a Telegram token before parsing groups.{' '}
                <RouterLink to="/tokens">Add Token</RouterLink>
              </Alert>
            ) : (
              <Box component="form" onSubmit={handleParseGroup}>
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
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={9}>
                    <TextField
                      fullWidth
                      label="Telegram Group Link"
                      placeholder="https://t.me/groupname"
                      value={groupLink}
                      onChange={(e) => setGroupLink(e.target.value)}
                      disabled={parsingStatus.loading}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      fullWidth
                      disabled={parsingStatus.loading}
                      startIcon={parsingStatus.loading ? <CircularProgress size={20} /> : <SendIcon />}
                      sx={{ height: '100%' }}
                    >
                      Parse
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Recent Groups */}
        {groups.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Groups
              </Typography>
              
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={2}>
                {groups.slice(0, 3).map((group) => (
                  <Grid item xs={12} sm={6} md={4} key={group.id}>
                    <Card className="card-hover">
                      <CardContent>
                        <Typography variant="h6" noWrap>
                          {group.group_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          @{group.group_username || 'private'}
                        </Typography>
                        <Typography variant="body2">
                          Members: {group.member_count}
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button 
                          component={RouterLink} 
                          to={`/groups/${group.id}`} 
                          size="small" 
                          color="primary"
                        >
                          View Details
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              
              {groups.length > 3 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button 
                    component={RouterLink} 
                    to="/groups" 
                    variant="outlined" 
                    color="primary"
                  >
                    View All Groups
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Dashboard; 