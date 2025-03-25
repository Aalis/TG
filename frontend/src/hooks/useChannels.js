import { useQuery } from '@tanstack/react-query';
import { channelsAPI } from '../services/api';

export const useChannels = () => {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsAPI.getAll(1, 42),  // Explicitly request all 42 items
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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