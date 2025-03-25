import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchChannels } from '../hooks/useChannels';
import { prefetchGroups } from '../hooks/useGroups';

const DataPrefetcher = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Start prefetching in the background
    const prefetchData = async () => {
      try {
        // Prefetch both channels and groups in parallel
        await Promise.all([
          prefetchChannels(queryClient),
          prefetchGroups(queryClient)
        ]);
      } catch (error) {
        console.error('Error prefetching data:', error);
      }
    };

    // Start prefetching immediately
    prefetchData();

    // Set up periodic refetching every 5 minutes
    const intervalId = setInterval(prefetchData, 5 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [queryClient]);

  // This component doesn't render anything
  return null;
};

export default DataPrefetcher; 