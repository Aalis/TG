import { useQuery, useQueryClient } from '@tanstack/react-query';
import { channelsAPI } from '../services/api';

// Query key constants
export const CHANNELS_QUERY_KEY = ['channels'];

export const useChannels = () => {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => channelsAPI.getAll(),
    staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
    gcTime: 10 * 60 * 1000,   // Keep unused data in cache for 10 minutes
    select: (response) => ({
      channels: response.data.sort((a, b) => new Date(b.parsed_at) - new Date(a.parsed_at)),
      totalCount: response.data.length > 0 ? response.data[0].total_count : 0
    })
  });

  return {
    channels: data?.channels || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error,
    refetch
  };
};

// Prefetch function to be used in App.js or layout component
export const prefetchChannels = async (queryClient) => {
  await queryClient.prefetchQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => channelsAPI.getAll(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000
  });
}; 