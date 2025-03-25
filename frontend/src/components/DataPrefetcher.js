import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChannels } from '../hooks/useChannels';
import { useGroups } from '../hooks/useGroups';
import { groupsAPI, channelsAPI } from '../services/api';

const DataPrefetcher = () => {
  const queryClient = useQueryClient();
  const { channels } = useChannels();
  const { groups } = useGroups();

  useEffect(() => {
    const prefetchData = async () => {
      if (!channels || !groups) return;

      console.log('Starting data prefetching...');
      console.log(`Found ${channels.length} channels and ${groups.length} groups to prefetch`);

      const allItems = [
        ...channels.map(c => ({ ...c, type: 'channel' })),
        ...groups.map(g => ({ ...g, type: 'group' }))
      ];
      console.log('Total items to prefetch:', allItems.length);

      for (const item of allItems) {
        const queryKey = ['cardDetails', item.id];
        const existingData = queryClient.getQueryData(queryKey);
        
        if (!existingData) {
          console.log(`Prefetching details for ${item.type}: ${item.group_name}`);
          try {
            const api = item.type === 'channel' ? channelsAPI : groupsAPI;
            const response = await api.getById(item.id);
            
            // Only prefetch if we got data successfully
            await queryClient.prefetchQuery({
              queryKey,
              queryFn: () => Promise.resolve(response.data),
              staleTime: 5 * 60 * 1000, // 5 minutes
              cacheTime: 30 * 60 * 1000, // 30 minutes
            });
            console.log(`Successfully prefetched ${item.type}: ${item.group_name}`);
          } catch (error) {
            console.error(`Failed to prefetch ${item.type}: ${item.group_name}`, error.message);
          }
        } else {
          console.log(`Data already cached for ${item.type}: ${item.group_name}`);
        }
      }
    };

    prefetchData();
  }, [channels, groups, queryClient]);

  // This component doesn't render anything
  return null;
};

export default DataPrefetcher; 