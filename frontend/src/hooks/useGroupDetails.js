import { useQuery } from '@tanstack/react-query';
import { groupsAPI } from '../services/api';

// Query key factory for group details
export const groupDetailsQueryKey = (groupId) => ['group', groupId];
export const groupPostsQueryKey = (groupId) => ['group', groupId, 'members'];

// Custom hook for fetching group details with caching
export const useGroupDetails = (groupId) => {
  const {
    data: group,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: groupDetailsQueryKey(groupId),
    queryFn: () => groupsAPI.getById(groupId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    select: (response) => response.data,
    retry: 1,
  });

  return {
    group,
    isLoading,
    isError,
    error,
    refetch
  };
};

// Prefetch function that can be used in other components
export const prefetchGroupDetails = async (queryClient, groupId) => {
  await queryClient.prefetchQuery({
    queryKey: groupDetailsQueryKey(groupId),
    queryFn: () => groupsAPI.getById(groupId),
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });
}; 