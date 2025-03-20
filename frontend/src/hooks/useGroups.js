import { useQuery, useQueryClient } from '@tanstack/react-query';
import { groupsAPI } from '../services/api';

export const useGroups = (page = 1) => {
  const queryClient = useQueryClient();

  // Pre-fetch next page
  const prefetchNextPage = async (nextPage) => {
    await queryClient.prefetchQuery({
      queryKey: ['groups', nextPage],
      queryFn: () => groupsAPI.getAll(nextPage),
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
    queryKey: ['groups', page],
    queryFn: () => groupsAPI.getAll(page),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    onSuccess: () => {
      // Prefetch next page
      prefetchNextPage(page + 1);
    },
    select: (response) => ({
      groups: response.data.sort((a, b) => new Date(b.parsed_at) - new Date(a.parsed_at)),
      totalCount: response.data.length > 0 ? response.data[0].total_count : 0
    })
  });

  return {
    groups: data?.groups || [],
    totalCount: data?.totalCount || 0,
    isLoading,
    error,
    refetch
  };
}; 