import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { fetchTopHoldersFromSubgraph, HolderGql } from './subgraph';

export interface Holder {
  address: string;
  balance: string;
  balanceUsd: number;
}

// Convert subgraph holder to frontend format
function holderGqlToHolder(holder: HolderGql, currentPrice: number): Holder {
  const balanceNum = parseFloat(formatUnits(BigInt(holder.balance), 18));
  return {
    address: holder.user,
    balance: formatUnits(BigInt(holder.balance), 18),
    balanceUsd: balanceNum * currentPrice,
  };
}

export function useTopHolders(
  marketId: number | null,
  currentPrice: number,
  side: 'yes' | 'no'
) {
  return useQuery({
    queryKey: ['topHolders', marketId, side, 'subgraph'],
    queryFn: async () => {
      if (!marketId || currentPrice <= 0) return [];

      try {
        // Fetch from subgraph (no rate limits, fast queries)
        const holdersGql = await fetchTopHoldersFromSubgraph(marketId, side === 'yes', 20);
        return holdersGql.map(h => holderGqlToHolder(h, currentPrice));
      } catch (error) {
        console.error('Error fetching holders from subgraph:', error);
        // Fallback to empty array if subgraph not available
        return [];
      }
    },
    enabled: !!marketId && currentPrice > 0,
    refetchInterval: 60000, // Refetch every minute
  });
}