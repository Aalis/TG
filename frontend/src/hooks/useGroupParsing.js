import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { groupsAPI } from '../services/api';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { GROUPS_QUERY_KEY } from './useGroups';

export const useGroupParsing = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  
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

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (progressPolling) {
        clearInterval(progressPolling);
      }
    };
  }, [progressPolling]);

  const startProgressPolling = useCallback(() => {
    // Stop any existing polling
    if (progressPolling) {
      clearInterval(progressPolling);
      setProgressPolling(null);
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await groupsAPI.getParsingProgress();
        setParsingProgress(response.data);
        
        // If parsing is complete, stop polling and update state
        if (
          response.data &&
          (response.data.status === 'completed' || 
           response.data.status === 'failed' ||
           response.data.status === 'cancelled')
        ) {
          clearInterval(pollInterval);
          setProgressPolling(null);
          
          if (response.data.status === 'completed') {
            setParsingStatus({
              loading: false,
              success: true,
              error: null,
            });
            
            // Invalidate the groups query to refresh the list
            queryClient.invalidateQueries(GROUPS_QUERY_KEY);
            
            enqueueSnackbar(t('telegram.parsingCompleted'), {
              variant: 'success',
              autoHideDuration: 3000,
            });
          } else if (response.data.status === 'failed') {
            setParsingStatus({
              loading: false,
              success: false,
              error: response.data.error || t('telegram.parsingFailed'),
            });
          } else if (response.data.status === 'cancelled') {
            setParsingStatus({
              loading: false,
              success: false,
              error: null,
            });
            enqueueSnackbar(t('telegram.parsingCancelled'), {
              variant: 'info',
              autoHideDuration: 3000,
            });
          }
        }
      } catch (err) {
        console.error('Error polling parsing progress:', err);
      }
    }, 1000);

    setProgressPolling(pollInterval);
  }, [progressPolling, enqueueSnackbar, queryClient, t]);

  const parseGroup = useCallback(async () => {
    try {
      setParsingStatus({
        loading: true,
        success: false,
        error: null,
      });
      
      // Parse using selected dialog or group link
      let response;
      if (selectedDialog) {
        response = await groupsAPI.parseGroup({
          dialog_id: selectedDialog.id,
          scan_comments: scanComments,
          comment_limit: commentLimit,
        });
      } else if (groupLink) {
        response = await groupsAPI.parseGroup({
          group_link: groupLink,
          scan_comments: scanComments,
          comment_limit: commentLimit,
        });
      } else {
        throw new Error(t('telegram.noGroupSelected'));
      }
      
      // Start progress polling
      startProgressPolling();
      
      // Clear form if successful
      setGroupLink('');
      setSelectedDialog(null);

      return response;
    } catch (err) {
      console.error('Error parsing group:', err);
      setParsingStatus({
        loading: false,
        success: false,
        error: err.response?.data?.detail || t('telegram.failedToParse'),
      });
      throw err;
    }
  }, [
    selectedDialog, 
    groupLink, 
    scanComments, 
    commentLimit,
    startProgressPolling,
    t
  ]);

  const fetchAvailableDialogs = useCallback(async () => {
    try {
      setLoadingDialogs(true);
      setDialogError(null);
      
      const response = await groupsAPI.getAvailableDialogs();
      setAvailableDialogs(response.data);
      
      if (response.data.length === 0) {
        setDialogError(t('telegram.noDialogsFound'));
      }
    } catch (err) {
      console.error('Error fetching dialogs:', err);
      setDialogError(err.response?.data?.detail || t('telegram.failedToFetchDialogs'));
    } finally {
      setLoadingDialogs(false);
    }
  }, [t]);

  const resetParsingState = useCallback(() => {
    setParsingStatus({
      loading: false,
      success: false,
      error: null,
    });
    setParsingProgress(null);
    
    if (progressPolling) {
      clearInterval(progressPolling);
      setProgressPolling(null);
    }
  }, [progressPolling]);

  const cancelParsing = useCallback(async () => {
    try {
      setIsCancelling(true);
      
      await groupsAPI.cancelParsing();
      
      if (progressPolling) {
        clearInterval(progressPolling);
        setProgressPolling(null);
      }
      
      setParsingStatus({
        loading: false,
        success: false,
        error: null,
      });
      
      enqueueSnackbar(t('telegram.parsingCancelled'), {
        variant: 'info',
        autoHideDuration: 3000,
      });
    } catch (err) {
      console.error('Error cancelling parsing:', err);
      enqueueSnackbar(
        err.response?.data?.detail || t('telegram.failedToCancelParsing'),
        { variant: 'error' }
      );
    } finally {
      setIsCancelling(false);
    }
  }, [progressPolling, enqueueSnackbar, t]);

  const openParseDialog = useCallback(() => {
    setParseDialogOpen(true);
    resetParsingState();
    fetchAvailableDialogs();
  }, [resetParsingState, fetchAvailableDialogs]);

  const closeParseDialog = useCallback(() => {
    if (parsingStatus.loading) {
      // Confirm before closing if parsing is in progress
      if (window.confirm(t('telegram.closeParsingDialogConfirm'))) {
        setParseDialogOpen(false);
      }
    } else {
      setParseDialogOpen(false);
    }
  }, [parsingStatus.loading, t]);

  return {
    parseDialogOpen,
    setParseDialogOpen,
    openParseDialog,
    closeParseDialog,
    groupLink,
    setGroupLink,
    scanComments,
    setScanComments,
    commentLimit,
    setCommentLimit,
    parsingProgress,
    availableDialogs,
    loadingDialogs,
    dialogError,
    selectedDialog,
    setSelectedDialog,
    isCancelling,
    parsingStatus,
    parseGroup,
    cancelParsing,
    resetParsingState,
    fetchAvailableDialogs
  };
}; 