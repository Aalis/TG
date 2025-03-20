import { useQuery, useQueryClient } from '@tanstack/react-query';
import { channelsAPI } from '../services/api';

export const useChannels = (page = 1) => {
  const queryClient = useQueryClient();

  // Pre-fetch next page
  const prefetchNextPage = async (nextPage) => {
    await queryClient.prefetchQuery({
      queryKey: ['channels', nextPage],
      queryFn: () => channelsAPI.getAll(nextPage),
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep data in cache for 10 minutes (renamed from cacheTime in v5)
    });
  };

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['channels', page],
    queryFn: () => channelsAPI.getAll(page),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    onSuccess: () => {
      // Prefetch next page
      prefetchNextPage(page + 1);
    },
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