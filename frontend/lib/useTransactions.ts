import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { fetchTransactionsFromSubgraph, TradeGql } from './subgraph';

export interface Transaction {
  id: string;
  type: 'BuyYes' | 'BuyNo' | 'SellYes' | 'SellNo';
  user: string;
  amount: string;
  output: string;
  price: string;
  timestamp: number;
  txHash: string;
}

// Convert subgraph trade to transaction format
function tradeToTransaction(trade: TradeGql): Transaction {
  return {
    id: trade.id,
    type: trade.type as 'BuyYes' | 'BuyNo' | 'SellYes' | 'SellNo',
    user: trade.user,
    amount: trade.isBuy 
      ? formatUnits(BigInt(trade.usdcAmount), 6)  // USDC spent for buys
      : formatUnits(BigInt(trade.tokenAmount), 18), // Tokens sold for sells
    output: trade.isBuy
      ? formatUnits(BigInt(trade.tokenAmount), 18) // Tokens received for buys
      : formatUnits(BigInt(trade.usdcAmount), 6),  // USDC received for sells
    price: formatUnits(BigInt(trade.priceE6), 6),
    timestamp: Number(trade.timestamp),
    txHash: trade.txHash,
  };
}

export function useTransactions(marketId: number | null) {
  return useQuery({
    queryKey: ['transactions', marketId, 'subgraph'],
    queryFn: async () => {
      if (!marketId) return [];
      
      try {
        // Fetch from subgraph (no rate limits, fast queries)
        const trades = await fetchTransactionsFromSubgraph(marketId, 100);
        console.log('useTransactions: fetched trades:', trades.length);
        const transactions = trades.map(tradeToTransaction);
        console.log('useTransactions: converted to transactions:', transactions.length);
        return transactions;
      } catch (error) {
        console.error('Error fetching transactions from subgraph:', error);
        // Fallback to empty array if subgraph not available
        return [];
      }
    },
    enabled: !!marketId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}