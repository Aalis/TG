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
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: CHANNELS_QUERY_KEY });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(CHANNELS_QUERY_KEY);
      
      // Optimistically update the cache
      if (previousData) {
        const updatedData = {
          ...previousData,
          data: previousData.data.filter(channel => channel.id !== channelId)
        };
        queryClient.setQueryData(CHANNELS_QUERY_KEY, updatedData);
      }
      
      // Return a context with the previous value
      return { previousData };
    },
    onError: (err, channelId, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousData) {
        queryClient.setQueryData(CHANNELS_QUERY_KEY, context.previousData);
      }
      // Return the error for UI handling
      return err;
    },
    onSettled: () => {
      // Always refetch after error or success to make sure the server state is reflected
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