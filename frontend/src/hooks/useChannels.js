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
    mutationFn: (channelId) => {
      console.log(`Starting actual deletion of channel ID: ${channelId}`);
      return channelsAPI.deleteChannel(channelId);
    },
    
    onMutate: async (channelId) => {
      try {
        console.log(`Optimistic update for channel ID: ${channelId}`);
        
        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: CHANNELS_QUERY_KEY });
        
        // Snapshot the previous value
        const previousData = queryClient.getQueryData(CHANNELS_QUERY_KEY);
        console.log("Delete - Data structure:", 
          previousData ? 
          (Array.isArray(previousData) ? "Array" : "Object with data property") : 
          "No data in cache");
        
        // Find the channel to delete for future reference
        let channelToDelete = null;
        if (previousData) {
          if (Array.isArray(previousData)) {
            channelToDelete = previousData.find(channel => channel.id === channelId);
            
            if (channelToDelete) {
              console.log(`Found channel to delete in cache: "${channelToDelete.group_name}" (ID: ${channelId})`);
              
              // Optimistically update the cache by removing the channel
              const filteredData = previousData.filter(channel => channel.id !== channelId);
              console.log(`Removed channel from cache. Before: ${previousData.length}, After: ${filteredData.length}`);
              
              queryClient.setQueryData(CHANNELS_QUERY_KEY, filteredData);
            } else {
              console.log(`Channel with ID ${channelId} not found in cache array`);
            }
          } else if (previousData.data && Array.isArray(previousData.data)) {
            channelToDelete = previousData.data.find(channel => channel.id === channelId);
            
            if (channelToDelete) {
              console.log(`Found channel to delete in cache data: "${channelToDelete.group_name}" (ID: ${channelId})`);
              
              // Optimistically update the cache by removing the channel
              const updatedData = {
                ...previousData,
                data: previousData.data.filter(channel => channel.id !== channelId)
              };
              console.log(`Removed channel from cache data. Before: ${previousData.data.length}, After: ${updatedData.data.length}`);
              
              queryClient.setQueryData(CHANNELS_QUERY_KEY, updatedData);
            } else {
              console.log(`Channel with ID ${channelId} not found in cache data object`);
            }
          }
        } else {
          console.log("No previous data in cache to update");
        }
        
        // Return a context with the previous value and channel info
        return { previousData, channelToDelete };
      } catch (error) {
        console.error("Error during optimistic update:", error);
        return { error };
      }
    },
    
    onError: (err, channelId, context) => {
      console.error(`Error deleting channel ${channelId}:`, err);
      const errorMessage = err.response?.data?.detail || '';
      
      // "not found" errors should be treated as success
      if (errorMessage.includes('not found') || errorMessage.includes('cache invalidated')) {
        console.log(`Channel ${channelId} was not found on server (likely already deleted)`);
        
        // Still make sure it's gone from the cache
        const currentData = queryClient.getQueryData(CHANNELS_QUERY_KEY);
        
        if (currentData) {
          // Remove from current data if still present
          if (Array.isArray(currentData)) {
            const stillExists = currentData.some(channel => channel.id === channelId);
            
            if (stillExists) {
              console.log(`Channel ${channelId} still exists in cache after "not found" error - removing it`);
              queryClient.setQueryData(
                CHANNELS_QUERY_KEY, 
                currentData.filter(channel => channel.id !== channelId)
              );
            }
          } else if (currentData.data && Array.isArray(currentData.data)) {
            const stillExists = currentData.data.some(channel => channel.id === channelId);
            
            if (stillExists) {
              console.log(`Channel ${channelId} still exists in cache data after "not found" error - removing it`);
              queryClient.setQueryData(
                CHANNELS_QUERY_KEY, 
                {
                  ...currentData,
                  data: currentData.data.filter(channel => channel.id !== channelId)
                }
              );
            }
          }
        }
        
        // Force a refetch to ensure consistency
        queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
        return; // Don't propagate the error
      }
      
      // For real errors, roll back the optimistic update
      if (context?.previousData) {
        console.log(`Rolling back optimistic update for channel ${channelId}`);
        queryClient.setQueryData(CHANNELS_QUERY_KEY, context.previousData);
      }
      
      // Re-throw for UI handling
      throw err;
    },
    
    onSuccess: (result, channelId) => {
      console.log(`Successfully deleted channel ${channelId} on server`);
      
      // Double-check cache to ensure deleted channel is gone
      const currentData = queryClient.getQueryData(CHANNELS_QUERY_KEY);
      let wasRemoved = false;
      
      if (currentData) {
        if (Array.isArray(currentData)) {
          const stillExists = currentData.some(channel => channel.id === channelId);
          
          if (stillExists) {
            console.log(`Channel ${channelId} still in cache after successful deletion - removing it`);
            queryClient.setQueryData(
              CHANNELS_QUERY_KEY, 
              currentData.filter(channel => channel.id !== channelId)
            );
            wasRemoved = true;
          }
        } else if (currentData.data && Array.isArray(currentData.data)) {
          const stillExists = currentData.data.some(channel => channel.id === channelId);
          
          if (stillExists) {
            console.log(`Channel ${channelId} still in cache data after successful deletion - removing it`);
            queryClient.setQueryData(
              CHANNELS_QUERY_KEY, 
              {
                ...currentData,
                data: currentData.data.filter(channel => channel.id !== channelId)
              }
            );
            wasRemoved = true;
          }
        }
      }
      
      // If we had to remove it again, log this unusual situation
      if (wasRemoved) {
        console.warn(`Had to remove channel ${channelId} from cache even after success - this is unusual`);
      }
      
      // Always invalidate to ensure we have fresh data
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    },
    
    onSettled: () => {
      // Always refetch after any outcome to ensure UI state is correct
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