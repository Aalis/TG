import { useQuery } from '@tanstack/react-query';

export const useCardDetails = (type, id) => {
  return useQuery({
    queryKey: ['cardDetails', id],
    queryFn: async () => {
      console.log(`Fetching details for ${type}: ${id}`);
      const response = await fetch(`/api/${type}s/${id}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      console.log(`Successfully fetched details for ${type}: ${id}`);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    select: (data) => {
      console.log(`Using data for ${type}: ${id} (${data.isCached ? 'from cache' : 'fresh fetch'})`);
      return data;
    }
  });
}; 