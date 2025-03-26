import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChannels } from '../hooks/useChannels';
import { useGroups } from '../hooks/useGroups';
import { groupsAPI, channelsAPI } from '../services/api';

// Constants
const MAX_PREFETCH_ITEMS = 30; // Limit the number of items to prefetch
const PREFETCH_DELAY_MS = 500; // Delay between prefetch requests
const MAX_RETRIES = 2; // Maximum number of retries for failed prefetch
const RETRY_DELAY_MS = 2000; // Delay before retry
const MAX_CHANNEL_ERRORS = 3; // After this many channel errors, disable channel prefetching temporarily

const DataPrefetcher = () => {
  const queryClient = useQueryClient();
  const { channels } = useChannels();
  const { groups } = useGroups();
  const channelErrorCount = useRef(0);
  const disableChannelPrefetch = useRef(false);

  useEffect(() => {
    const prefetchItemWithRetry = async (item, retryCount = 0) => {
      const queryKey = ['cardDetails', item.id];
      const existingData = queryClient.getQueryData(queryKey);
      
      if (existingData) {
        console.log(`Data already cached for ${item.type}: ${item.group_name}`);
        return true;
      }

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
        return true;
      } catch (error) {
        console.error(`Failed to prefetch ${item.type}: ${item.group_name}`, error.message);
        
        // Track channel errors
        if (item.type === 'channel') {
          channelErrorCount.current += 1;
          
          // Disable channel prefetching if too many errors
          if (channelErrorCount.current >= MAX_CHANNEL_ERRORS) {
            console.warn(`Temporarily disabling channel prefetching due to ${channelErrorCount.current} errors`);
            disableChannelPrefetch.current = true;
          }
        }
        
        // Retry the prefetch if we haven't exceeded MAX_RETRIES
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying prefetch for ${item.type}: ${item.group_name} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          return prefetchItemWithRetry(item, retryCount + 1);
        }
        
        return false;
      }
    };

    const prefetchData = async () => {
      if (!channels || !groups) return;

      console.log('Starting data prefetching...');
      console.log(`Found ${channels.length} channels and ${groups.length} groups to prefetch`);

      // Reset error counters at the start of a new prefetch cycle
      channelErrorCount.current = 0;
      
      // Every 5 minutes, try channel prefetching again even if it was disabled
      if (disableChannelPrefetch.current) {
        setTimeout(() => {
          disableChannelPrefetch.current = false;
        }, 5 * 60 * 1000);
      }

      // Prepare items to prefetch based on current state
      let itemsToProcess = [];
      
      // Always include groups
      const groupsToFetch = groups
        .map(g => ({ ...g, type: 'group' }))
        .sort((a, b) => new Date(b.parsed_at) - new Date(a.parsed_at))
        .slice(0, MAX_PREFETCH_ITEMS / 2);
      
      itemsToProcess = [...groupsToFetch];
      
      // Only include channels if not disabled
      if (!disableChannelPrefetch.current) {
        const channelsToFetch = channels
          .map(c => ({ ...c, type: 'channel' }))
          .sort((a, b) => new Date(b.parsed_at) - new Date(a.parsed_at))
          .slice(0, MAX_PREFETCH_ITEMS / 2);
          
        itemsToProcess = [...itemsToProcess, ...channelsToFetch];
      } else {
        console.log('Channel prefetching is temporarily disabled due to previous errors');
      }
      
      // Sort all selected items by recency
      itemsToProcess.sort((a, b) => new Date(b.parsed_at) - new Date(a.parsed_at));
      
      // Limit to MAX_PREFETCH_ITEMS
      itemsToProcess = itemsToProcess.slice(0, MAX_PREFETCH_ITEMS);
      
      console.log(`Prefetching top ${itemsToProcess.length} most recent items`);

      for (const item of itemsToProcess) {
        // Add a small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, PREFETCH_DELAY_MS));
        await prefetchItemWithRetry(item);
      }
    };

    // Delay initial prefetching slightly to prioritize rendering
    const timeoutId = setTimeout(() => {
      prefetchData();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [channels, groups, queryClient]);

  // This component doesn't render anything
  return null;
};

export default DataPrefetcher; 