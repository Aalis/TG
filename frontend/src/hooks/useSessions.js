import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsAPI } from '../services/api';

// Query keys
export const SESSIONS_QUERY_KEY = ['sessions'];
export const SESSION_VERIFICATION_KEY = ['session', 'verification'];

/**
 * Hook for fetching and managing Telegram sessions with caching
 */
export const useSessions = () => {
  const queryClient = useQueryClient();
  
  // Fetch sessions with caching
  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await sessionsAPI.getAll();
      return response.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  // Mutation for sending verification code
  const sendVerificationCodeMutation = useMutation({
    mutationFn: (phoneNumber) => sessionsAPI.verifyPhone(phoneNumber),
    mutationKey: [SESSION_VERIFICATION_KEY, 'send']
  });

  // Mutation for verifying code and creating session
  const verifyCodeMutation = useMutation({
    mutationFn: ({ phoneNumber, code, phoneCodeHash, password }) => 
      sessionsAPI.verifyCode(phoneNumber, code, phoneCodeHash, password),
    onSuccess: () => {
      // Invalidate sessions query to refresh the list
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    },
    mutationKey: [SESSION_VERIFICATION_KEY, 'verify']
  });

  // Mutation for toggling session status with optimistic updates
  const toggleSessionMutation = useMutation({
    mutationFn: ({ sessionId, isActive }) => sessionsAPI.update(sessionId, isActive),
    onMutate: async ({ sessionId, isActive }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: SESSIONS_QUERY_KEY });
      
      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData(SESSIONS_QUERY_KEY);
      
      // Optimistically update to the new value
      queryClient.setQueryData(SESSIONS_QUERY_KEY, oldSessions => 
        oldSessions.map(session => {
          // If activating a session, deactivate all others (matching backend behavior)
          if (isActive && session.id !== sessionId) {
            return { ...session, is_active: false };
          }
          // Toggle the clicked session
          if (session.id === sessionId) {
            return { ...session, is_active: isActive };
          }
          return session;
        })
      );
      
      // Return a context with the previous value
      return { previousSessions };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousSessions) {
        queryClient.setQueryData(SESSIONS_QUERY_KEY, context.previousSessions);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to make sure the server state is reflected
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    }
  });

  // Mutation for deleting a session with optimistic updates
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId) => sessionsAPI.delete(sessionId),
    onMutate: async (sessionId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: SESSIONS_QUERY_KEY });
      
      // Snapshot the previous value
      const previousSessions = queryClient.getQueryData(SESSIONS_QUERY_KEY);
      
      // Optimistically update by removing the session
      queryClient.setQueryData(SESSIONS_QUERY_KEY, oldSessions => 
        oldSessions.filter(session => session.id !== sessionId)
      );
      
      // Return a context with the previous value
      return { previousSessions };
    },
    onError: (err, sessionId, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousSessions) {
        queryClient.setQueryData(SESSIONS_QUERY_KEY, context.previousSessions);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to make sure the server state is reflected
      queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    }
  });

  return {
    sessions,
    isLoading,
    isError,
    error,
    refetch,
    toggleSession: (sessionId, isActive) => 
      toggleSessionMutation.mutate({ sessionId, isActive }),
    deleteSession: (sessionId) => 
      deleteSessionMutation.mutate(sessionId),
    sendVerificationCode: (phoneNumber) =>
      sendVerificationCodeMutation.mutateAsync(phoneNumber),
    verifyCode: (params) =>
      verifyCodeMutation.mutateAsync(params),
    isToggling: toggleSessionMutation.isLoading,
    isDeleting: deleteSessionMutation.isLoading,
    isSendingCode: sendVerificationCodeMutation.isLoading,
    isVerifying: verifyCodeMutation.isLoading,
    toggleError: toggleSessionMutation.error,
    deleteError: deleteSessionMutation.error,
    verificationError: verifyCodeMutation.error,
    sendCodeError: sendVerificationCodeMutation.error
  };
};

// Function to prefetch sessions data (can be used in App.js)
export const prefetchSessions = async (queryClient) => {
  await queryClient.prefetchQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await sessionsAPI.getAll();
      return response.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000
  });
}; 