import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
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
  Pagination,
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
import { useTranslation } from 'react-i18next';
import ParseButtonHeader from '../components/ParseButtonHeader';
import { useGroups } from '../hooks/useGroups';

const ParsedGroups = () => {
  const { t } = useTranslation();
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
  const [parsingStatus, setParsingStatus] = useState({
    loading: false,
    success: false,
    error: null,
  });
  
  // Pagination constants
  const ITEMS_PER_PAGE = 21;
  const MAX_TOTAL_ITEMS = 42;
  
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();

  // Get page from URL query parameter or default to 1
  const getPageFromUrl = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) : 1;
  }, [location.search]);

  // Initialize page from URL on component mount
  const [page, setPage] = useState(getPageFromUrl());
  const [paginatedGroups, setPaginatedGroups] = useState([]);
  
  // Use the groups hook for caching
  const { 
    groups, 
    totalCount, 
    isLoading, 
    error: queryError, 
    refetch 
  } = useGroups(page);

  // Sync URL with page state when page changes
  const updateUrlWithPage = useCallback((newPage) => {
    const searchParams = new URLSearchParams(location.search);
    
    if (newPage === 1) {
      searchParams.delete('page');
    } else {
      searchParams.set('page', newPage.toString());
    }
    
    const newSearch = searchParams.toString();
    const newPath = location.pathname + (newSearch ? `?${newSearch}` : '');
    
    navigate(newPath, { replace: false });
  }, [location.pathname, location.search, navigate]);

  // Handle page change from pagination component
  const handlePageChange = useCallback((event, newPage) => {
    setPage(newPage);
    updateUrlWithPage(newPage);
    window.scrollTo(0, 0);
  }, [updateUrlWithPage]);

  // Sync page state with URL when URL changes (e.g., back button)
  useEffect(() => {
    const urlPage = getPageFromUrl();
    if (page !== urlPage) {
      setPage(urlPage);
    }
  }, [location.search, getPageFromUrl, page]);

  // Filter groups when search term changes
  const [filteredGroups, setFilteredGroups] = useState([]);
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
    // Reset to first page when search changes
    if (page !== 1) {
      setPage(1);
      updateUrlWithPage(1);
    }
  }, [searchTerm, groups, page, updateUrlWithPage]);

  // Update paginated groups when filtered groups or page changes
  useEffect(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setPaginatedGroups(filteredGroups.slice(startIndex, endIndex));
  }, [filteredGroups, page]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressPolling) {
        clearInterval(progressPolling);
      }
    };
  }, [progressPolling]);

  // Show error notification if groups fetch fails
  useEffect(() => {
    if (queryError) {
      enqueueSnackbar('Failed to load groups. Please try again.', { 
        variant: 'error',
        autoHideDuration: 3000
      });
    }
  }, [queryError, enqueueSnackbar]);

  const handleDeleteClick = (group) => {
    setGroupToDelete(group);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await groupsAPI.delete(groupToDelete.id);
      
      // Refresh groups list using the cached query
      await refetch();
      
      // Close dialog
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
      
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to delete group', { 
        variant: 'error' 
      });
    }
  };

  const startProgressPolling = () => {
    // Stop any existing polling
    if (progressPolling) {
      clearInterval(progressPolling);
      setProgressPolling(null);
    }

    // Reset any existing parsing progress
    setParsingProgress(null);

    // Set loading state but preserve any other state
    setParsingStatus(prev => ({ ...prev, loading: true, error: null }));

    // Initialize the parsing progress state
    setParsingProgress({
      is_parsing: true,
      progress: 0,
      phase: 'initializing',
      message: 'Starting parsing process...'
    });

    // Start new polling
    const pollInterval = setInterval(async () => {
      try {
        const response = await groupsAPI.getParsingProgress();
        
        // Only update if we're still parsing
        if (response.data && response.data.is_parsing !== undefined) {
          setParsingProgress(response.data);
          
          // Stop polling if parsing is complete or errored
          if (!response.data.is_parsing) {
            clearInterval(pollInterval);
            setProgressPolling(null);
            // Close the progress dialog when parsing is complete
            setParsingProgress(null);
            
            // If parsing was cancelled by the backend, close the parse dialog too
            if (response.data.message && response.data.message.includes('cancelled')) {
              setParseDialogOpen(false);
              // Reset all parsing-related state
              resetParsingState();
            }
          }
        } else {
          // If we get an unexpected response, stop polling
          clearInterval(pollInterval);
          setProgressPolling(null);
          setParsingProgress(null);
        }
      } catch (err) {
        console.error('Error fetching parsing progress:', err);
        // If there's an error polling, stop and clean up
        clearInterval(pollInterval);
        setProgressPolling(null);
        setParsingProgress(null);
        // Show error notification
        enqueueSnackbar('Error tracking parsing progress', { variant: 'error' });
      }
    }, 1000); // Poll every second

    setProgressPolling(pollInterval);
  };

  const handleParseGroup = async () => {
    if (!groupLink && !selectedDialog) {
      setParsingStatus({
        loading: false,
        success: false,
        error: 'Please enter a group link or select a group from the list',
      });
      return;
    }

    try {
      // Reset any previous parsing state to ensure a clean start
      resetParsingState();
      
      setParsingStatus({ loading: true, success: false, error: null });
      
      // Start progress polling before making the API call
      startProgressPolling();
      
      // Check if we need to delete the oldest group
      if (groups.length >= MAX_TOTAL_ITEMS) {
        // Sort by parsed_at in ascending order to get the oldest
        const sortedGroups = [...groups].sort((a, b) => 
          new Date(a.parsed_at) - new Date(b.parsed_at)
        );
        const oldestGroup = sortedGroups[0];
        
        // Delete the oldest group
        await groupsAPI.delete(oldestGroup.id);
        enqueueSnackbar(`Oldest group "${oldestGroup.group_name}" was automatically deleted to maintain the limit of ${MAX_TOTAL_ITEMS} groups`, { 
          variant: 'info',
          autoHideDuration: 5000
        });
      }

      // Make the API call
      const response = await groupsAPI.parseGroup(
        selectedDialog ? selectedDialog.id : groupLink.trim(),
        scanComments,
        scanComments ? commentLimit : 100
      );

      if (response.data.success) {
        setParsingStatus({
          loading: false,
          success: true,
          error: null,
        });
        
        // Navigate to the group details page
        navigate(`/groups/${response.data.group.id}`);
        
        // Close dialog and reset state
        setParseDialogOpen(false);
        setGroupLink('');
        setScanComments(false);
        setCommentLimit(100);
        setSelectedDialog(null);
        refetch();
        enqueueSnackbar('Group parsed successfully!', { variant: 'success' });
      } else {
        setParsingStatus({
          loading: false,
          success: false,
          error: response.data.message,
        });
        
        // Clear progress dialog if parsing failed
        resetParsingState();
      }
    } catch (err) {
      // Stop progress polling if there's an error
      resetParsingState();
      
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

  const fetchAvailableDialogs = async () => {
    try {
      setLoadingDialogs(true);
      setDialogError(null);
      const response = await groupsAPI.getDialogs();
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response format');
      }
      
      // Filter and sort dialogs
      const filteredDialogs = response.data
        .filter(dialog => dialog.type === 'group')
        .sort((a, b) => (b.members_count || 0) - (a.members_count || 0));
      
      setAvailableDialogs(filteredDialogs);
    } catch (err) {
      console.error('Error fetching dialogs:', err);
      if (err.response?.status === 401) {
        setDialogError(t('telegram.noActiveSession'));
      } else if (err.response?.status === 403) {
        setDialogError(t('telegram.sessionNotVerified'));
      } else {
        setDialogError(t('telegram.failedToLoadGroups'));
      }
    } finally {
      setLoadingDialogs(false);
    }
  };

  // Update the resetParsingState function to be more thorough
  const resetParsingState = () => {
    // Clear all parsing-related state
    setParsingStatus({ loading: false, success: false, error: null });
    setParsingProgress(null);
    
    // Clear any polling intervals
    if (progressPolling) {
      clearInterval(progressPolling);
      setProgressPolling(null);
    }
    
    // Remove any error messages that might be in the DOM
    const errorElements = document.querySelectorAll('.MuiAlert-standardError');
    errorElements.forEach(el => {
      if (el.textContent.includes('cancelled')) {
        el.style.display = 'none';
      }
    });

    // Ensure the parse dialog is closed if it was open
    setIsCancelling(false);
  };

  // Update the handleCancelParsing function to be more thorough
  const handleCancelParsing = async () => {
    try {
      setIsCancelling(true);
      await groupsAPI.cancelParsing();
      
      // Show a brief cancellation message
      enqueueSnackbar('Parsing cancelled', { variant: 'info' });
      
      // Reset all parsing-related state
      resetParsingState();
      
      // Also close the parse dialog if it's open
      setParseDialogOpen(false);
      
      // Force a small delay to ensure UI updates properly
      setTimeout(() => {
        // Double-check that all error messages are cleared
        setParsingStatus({ loading: false, success: false, error: null });
        // Explicitly set parsingProgress to null to ensure the dialog closes
        setParsingProgress(null);
      }, 300);
    } catch (err) {
      console.error('Error cancelling parsing:', err);
      enqueueSnackbar('Failed to cancel parsing', { variant: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Add a helper function to filter out cancellation errors
  const shouldShowError = (error) => {
    if (!error) return false;
    if (error.includes("cancelled")) return false;
    return true;
  };

  // Update the useEffect for parseDialogOpen
  useEffect(() => {
    if (parseDialogOpen) {
      // Reset all parsing-related state when dialog opens
      resetParsingState();
      // Reset form fields
      setSelectedDialog(null);
      setGroupLink('');
      setScanComments(false);
      setCommentLimit(100);
      // Fetch available dialogs
      fetchAvailableDialogs();
    }
  }, [parseDialogOpen]);

  // Check if we should open the parse dialog when navigating back from details page
  useEffect(() => {
    if (location.state?.openParseDialog) {
      // Reset all parsing-related state
      resetParsingState();
      // Clear any previous error messages when opening the dialog
      setParsingStatus({ loading: false, success: false, error: null });
      // Reset form fields
      setSelectedDialog(null);
      setGroupLink('');
      // Open the dialog
      setParseDialogOpen(true);
      // Clear the state to prevent reopening on further navigation
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, resetParsingState]);

  if (isLoading && groups.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <ParseButtonHeader
        title={t('navigation.parsedGroups')}
        entityType="group"
        onButtonClick={() => {
          // Reset all parsing-related state
          resetParsingState();
          // Clear any previous error messages when opening the dialog
          setParsingStatus({ loading: false, success: false, error: null });
          // Reset form fields
          setSelectedDialog(null);
          setGroupLink('');
          // Open the dialog
          setParseDialogOpen(true);
        }}
      />
      
      {queryError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {queryError}
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder={t('common.searchPlaceholder')}
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
                {t('telegram.noParsedGroupsFound')}
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                {t('telegram.checkActiveSession')} <RouterLink to="/sessions" style={{ color: '#1976d2', fontWeight: 500 }}>{t('telegram.session')}</RouterLink>.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => {
                  // Clear any previous error messages when opening the dialog
                  setParsingStatus({ loading: false, success: false, error: null });
                  setParseDialogOpen(true);
                }}
              >
                {t('telegram.parseFirstGroup')}
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                {t('common.noResults')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t('common.noGroupsMatchSearch')}
              </Typography>
            </>
          )}
        </Paper>
      ) : (
        <>
          <Grid container spacing={3}>
            {paginatedGroups.map((group) => (
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
                      {group.group_username ? `@${group.group_username}` : t('telegram.privateGroup')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', mt: 1, mb: 1, gap: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Chip 
                          label={`${group.member_count.toLocaleString()} ${t('common.members')}`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                        <Chip 
                          label={`${(group.members?.length || 0).toLocaleString()} ${t('common.usersFound')}`} 
                          size="small" 
                          color="info" 
                          variant="outlined"
                        />
                      </Box>
                      <Chip 
                        label={group.is_public ? t('common.public') : t('common.private')} 
                        size="small" 
                        color={group.is_public ? 'success' : 'default'} 
                        variant="outlined"
                      />
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('common.parsed')}: {(() => {
                        // Parse the timestamp from the server and adjust for timezone
                        const serverDate = new Date(group.parsed_at);
                        
                        // Get the timezone offset in minutes
                        const timezoneOffset = new Date().getTimezoneOffset();
                        
                        // Create a new date adjusted for the local timezone
                        const localDate = new Date(serverDate.getTime() - (timezoneOffset * 60000));
                        
                        // Format the date in local timezone
                        return localDate.toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }) + ' ' + localDate.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        });
                      })()}
                    </Typography>
                  </CardContent>
                  
                  <CardActions>
                    <Box sx={{ flexGrow: 1 }} />
                    
                    <Tooltip title={t('actions.delete')}>
                      <IconButton 
                        color="error" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(group);
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
          {filteredGroups.length > ITEMS_PER_PAGE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
              <Pagination 
                count={Math.ceil(filteredGroups.length / ITEMS_PER_PAGE)} 
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
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>{t('actions.confirm')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('telegram.deleteGroupConfirm', { groupName: groupToDelete?.group_name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Parse Group Dialog */}
      <Dialog open={parseDialogOpen} onClose={() => {
        if (!parsingStatus.loading) {
          setParseDialogOpen(false);
          setSelectedDialog(null);
          setGroupLink('');
          resetParsingState();
        }
      }} maxWidth="sm" fullWidth>
        <DialogTitle>{t('telegram.parseNewGroup')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('telegram.selectGroup')}
          </DialogContentText>

          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {dialogError}
            </Alert>
          )}

          {/* Available Groups List */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t('telegram.yourTelegramGroups')}
            </Typography>
            {loadingDialogs ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : dialogError ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {dialogError}
                {dialogError === t('telegram.noActiveSession') && (
                  <Button
                    component={RouterLink}
                    to="/sessions"
                    color="primary"
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    {t('telegram.goToSessions')}
                  </Button>
                )}
              </Alert>
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
                        setParsingStatus({ loading: false, success: false, error: null });
                      }}
                    >
                      <Typography variant="subtitle2">
                        {dialog.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dialog.username ? `@${dialog.username}` : t('telegram.privateGroup')} • {dialog.members_count} {t('common.members')}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('telegram.noGroupsFound')}
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom>
            {t('telegram.orEnterGroupLinkManually')}
          </Typography>
          
          <TextField
            margin="dense"
            label={t('telegram.groupLink')}
            fullWidth
            variant="outlined"
            value={groupLink}
            onChange={(e) => {
              setGroupLink(e.target.value);
              setSelectedDialog(null);
              setParsingStatus({ loading: false, success: false, error: null });
            }}
            disabled={parsingStatus.loading}
            error={shouldShowError(parsingStatus.error)}
            helperText={shouldShowError(parsingStatus.error) ? parsingStatus.error : ' '}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={scanComments}
                onChange={(e) => setScanComments(e.target.checked)}
                disabled={parsingStatus.loading}
              />
            }
            label={t('telegram.scanCommentsForAdditionalUsers')}
            sx={{ mb: 2 }}
          />

          {scanComments && (
            <FormControl fullWidth variant="outlined">
              <InputLabel>{t('telegram.commentScanLimit')}</InputLabel>
              <Select
                value={commentLimit}
                onChange={(e) => setCommentLimit(e.target.value)}
                label={t('telegram.commentScanLimit')}
                disabled={parsingStatus.loading}
              >
                <MenuItem value={100}>{t('telegram.last100Comments')}</MenuItem>
                <MenuItem value={1000}>{t('telegram.last1000Comments')}</MenuItem>
                <MenuItem value={5000}>{t('telegram.last5000Comments')}</MenuItem>
                <MenuItem value={10000}>{t('telegram.last10000Comments')}</MenuItem>
              </Select>
              <FormHelperText>
                {t('telegram.selectHowManyRecentComments')}
              </FormHelperText>
            </FormControl>
          )}

          {/* Subscription Expired Alert */}
          {parsingStatus.error && parsingStatus.error.includes("subscription has expired") && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'error.light', borderRadius: 1, opacity: 0.9 }}>
              <Typography variant="subtitle2" color="error.dark" gutterBottom>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>⚠️</span> {t('telegram.parsingSubscriptionExpired')}
                </Box>
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  component={RouterLink} 
                  to="/subscribe"
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                >
                  {t('common.subscribe')}
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    setParseDialogOpen(false);
                    setSelectedDialog(null);
                    setGroupLink('');
                    resetParsingState();
                  }}
                >
                  {t('common.close')}
                </Button>
              </Box>
            </Box>
          )}

          {/* Regular Error Alert - Don't show cancellation errors */}
          {shouldShowError(parsingStatus.error) && 
            !parsingStatus.error.includes("subscription has expired") && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {parsingStatus.error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button 
            onClick={() => {
              setParseDialogOpen(false);
              setSelectedDialog(null);
              setGroupLink('');
              resetParsingState();
            }} 
            disabled={parsingStatus.loading}
            variant="outlined"
            sx={{ textTransform: 'uppercase' }}
          >
            {t('telegram.cancel')}
          </Button>
          <LoadingButton
            onClick={handleParseGroup}
            loading={parsingStatus.loading}
            loadingPosition="start"
            startIcon={<SendIcon />}
            variant="contained"
            disabled={parsingStatus.loading || (!groupLink.trim() && !selectedDialog)}
          >
            {t('telegram.parseGroup')}
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog 
        open={!!parsingProgress && parsingProgress.is_parsing} 
        maxWidth="sm" 
        fullWidth
        onClose={() => {
          // Only allow closing via the cancel button
          if (!parsingProgress?.is_parsing) {
            resetParsingState();
          }
        }}
      >
        <DialogTitle>{t('telegram.parsingGroup')}</DialogTitle>
        <DialogContent>
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="body1" gutterBottom>
              {parsingProgress?.message || t('common.initializing')}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={parsingProgress?.progress || 0}
              sx={{ my: 2 }}
            />
            <Typography variant="body2" color="text.secondary">
              {t('common.phase')}: {parsingProgress?.phase || 'initializing'}
            </Typography>
            {parsingProgress?.total_members > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('common.members')}: {parsingProgress.current_members} / {parsingProgress.total_members}
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
            {t('common.cancelParsing')}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParsedGroups; 