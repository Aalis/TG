import { useQuery, useQueryClient } from '@tanstack/react-query';
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

  return {
    channels: data?.channels || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error,
    refetch,
    refetchWithoutCache
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