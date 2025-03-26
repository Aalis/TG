import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { channelsAPI } from '../services/api';

// Query key constants
export const CHANNELS_QUERY_KEY = ['channels'];

export const useChannels = (skipCache = false) => {
  const queryClient = useQueryClient();
  
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => channelsAPI.getAll(1, 42, skipCache),
    staleTime: skipCache ? 0 : 5 * 60 * 1000, // If skipCache, always consider data stale
    gcTime: 10 * 60 * 1000,   // Keep unused data in cache for 10 minutes
    select: (response) => ({
      channels: response.data.sort((a, b) => new Date(b.parsed_at) - new Date(a.parsed_at)),
      totalCount: response.data.length > 0 ? response.data[0].total_count : 0
    })
  });

  // Custom refetch function that can skip the cache on demand
  const refetchWithoutCache = async () => {
    // First invalidate the query to ensure it won't use cached data
    await queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    // Then refetch with skipCache=true to bypass backend cache
    return channelsAPI.getAll(1, 42, true).then(response => {
      // Manually update the query data
      queryClient.setQueryData(CHANNELS_QUERY_KEY, response);
      return response;
    });
  };

  // Mutation for deleting a channel with optimistic updates
  const deleteChannelMutation = useMutation({
    mutationFn: (channelId) => channelsAPI.deleteChannel(channelId),
    onMutate: async (channelId) => {
      try {
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: CHANNELS_QUERY_KEY });
        
        // Snapshot the previous value
        const previousData = queryClient.getQueryData(CHANNELS_QUERY_KEY);
        console.log("Delete - Previous data structure:", 
          previousData ? 
          (Array.isArray(previousData) ? "Array" : "Object with data property") : 
          "No data in cache");
        
        // Find the channel to delete for future reference
        let channelToDelete = null;
        if (previousData) {
          if (Array.isArray(previousData)) {
            channelToDelete = previousData.find(channel => channel.id === channelId);
            // Optimistically update the cache by removing the channel
            queryClient.setQueryData(CHANNELS_QUERY_KEY, 
              previousData.filter(channel => channel.id !== channelId)
            );
          } else if (previousData.data && Array.isArray(previousData.data)) {
            channelToDelete = previousData.data.find(channel => channel.id === channelId);
            // Optimistically update the cache by removing the channel
            const updatedData = {
              ...previousData,
              data: previousData.data.filter(channel => channel.id !== channelId)
            };
            queryClient.setQueryData(CHANNELS_QUERY_KEY, updatedData);
          }
        }
        
        // Return a context with the previous value and channel info
        return { previousData, channelToDelete };
      } catch (error) {
        console.error("Error during optimistic update:", error);
        return { error };
      }
    },
    onError: (err, channelId, context) => {
      console.error("Error deleting channel:", err);
      
      const errorMessage = err.response?.data?.detail || '';
      
      // If the error is "not found" or "channel not found, cache invalidated"
      // we consider this a successful deletion (already deleted)
      if (errorMessage.includes('not found') || 
          errorMessage.includes('cache invalidated')) {
        console.log("Channel was already deleted on server but still in cache");
        
        // Still treat this as success - no need to rollback
        // Just make sure it's gone from the UI
        const currentData = queryClient.getQueryData(CHANNELS_QUERY_KEY);
        
        if (currentData) {
          if (Array.isArray(currentData)) {
            // Make sure the channel is removed from the UI
            queryClient.setQueryData(CHANNELS_QUERY_KEY, 
              currentData.filter(channel => channel.id !== channelId)
            );
          } else if (currentData.data && Array.isArray(currentData.data)) {
            const updatedData = {
              ...currentData,
              data: currentData.data.filter(channel => channel.id !== channelId)
            };
            queryClient.setQueryData(CHANNELS_QUERY_KEY, updatedData);
          }
        }
        
        // Consider this a success and don't propagate the error
        return;
      }
      
      // For other real errors, roll back to previous state
      if (context?.previousData) {
        queryClient.setQueryData(CHANNELS_QUERY_KEY, context.previousData);
      }
      
      // Re-throw the error for UI handling
      throw err;
    },
    onSuccess: (data, channelId) => {
      console.log(`Channel ${channelId} deleted successfully`);
      
      // Double-check that the channel is removed from UI
      const currentData = queryClient.getQueryData(CHANNELS_QUERY_KEY);
      if (currentData) {
        if (Array.isArray(currentData)) {
          if (currentData.some(channel => channel.id === channelId)) {
            // If channel still exists in the UI, remove it
            queryClient.setQueryData(CHANNELS_QUERY_KEY, 
              currentData.filter(channel => channel.id !== channelId)
            );
          }
        } else if (currentData.data && Array.isArray(currentData.data)) {
          if (currentData.data.some(channel => channel.id === channelId)) {
            // If channel still exists in the UI, remove it
            const updatedData = {
              ...currentData,
              data: currentData.data.filter(channel => channel.id !== channelId)
            };
            queryClient.setQueryData(CHANNELS_QUERY_KEY, updatedData);
          }
        }
      }
      
      // Always refetch to ensure UI state is in sync
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    },
    onSettled: () => {
      // Refetch after any outcome to ensure UI state is correct
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    }
  });

  return {
    channels: data?.channels || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error,
    refetch,
    refetchWithoutCache,
    deleteChannel: deleteChannelMutation.mutate,
    deleteChannelAsync: deleteChannelMutation.mutateAsync,
    isDeletingChannel: deleteChannelMutation.isLoading,
    deleteChannelError: deleteChannelMutation.error
  };
};

// Prefetch function to be used in App.js or layout component
export const prefetchChannels = async (queryClient, skipCache = false) => {
  await queryClient.prefetchQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => channelsAPI.getAll(1, 42, skipCache),
    staleTime: skipCache ? 0 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });
}; 