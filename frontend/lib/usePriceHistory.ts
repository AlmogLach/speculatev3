import { useQuery } from '@tanstack/react-query';
import { fetchCandlesFromSubgraph, CandleGql } from './subgraph';

export type PricePoint = {
  timestamp: number;
  priceYes: number; // YES price in USD (0-1 range)
  priceNo: number; // NO price in USD (0-1 range)
  volume: number;
};

// Backward compatibility - keep price field for existing code
export type PricePointLegacy = {
  timestamp: number;
  price: number; // YES price in USD (0-1 range)
  volume: number;
};

function candlesToPricePoints(candles: CandleGql[]): PricePoint[] {
  const points = candles.map((candle) => {
    const closeYES = parseFloat(candle.closeYES);
    const closeNO = parseFloat(candle.closeNO);
    const priceYes = closeYES / 1000000; // Convert E6 to decimal (0-1 range)
    const priceNo = closeNO / 1000000; // Convert E6 to decimal (0-1 range)
    
    if (isNaN(priceYes) || priceYes < 0 || priceYes > 1) {
      console.warn('[usePriceHistory] Invalid YES price:', { 
        closeYES: candle.closeYES, 
        calculated: priceYes,
        candle: candle.id 
      });
    }
    
    if (isNaN(priceNo) || priceNo < 0 || priceNo > 1) {
      console.warn('[usePriceHistory] Invalid NO price:', { 
        closeNO: candle.closeNO, 
        calculated: priceNo,
        candle: candle.id 
      });
    }
    
    return {
      timestamp: parseInt(candle.startTimestamp),
      priceYes: priceYes,
      priceNo: priceNo,
      volume: parseFloat(candle.volume) / 1000000, // Convert from 6 decimals to USD
    };
  });
  
  return points.filter(p => !isNaN(p.priceYes) && !isNaN(p.priceNo) && p.priceYes >= 0 && p.priceYes <= 1 && p.priceNo >= 0 && p.priceNo <= 1);
}

export function usePriceHistory(
  marketId: number | null,
  timeRange: '1D' | '1W' | '1M' | 'ALL' = '1W'
) {
  // Auto-select timeframe based on timeRange for optimal granularity
  const timeframe: '5m' | '1h' | '1d' = 
    timeRange === '1D' ? '5m' :
    timeRange === '1W' ? '1h' :
    timeRange === '1M' ? '1h' :
    '1d'; // ALL uses daily candles
  return useQuery({
    queryKey: ['priceHistory', marketId, timeframe, timeRange],
    queryFn: async () => {
      if (!marketId) return [];

      // Calculate fromTimestamp based on timeRange
      const now = Math.floor(Date.now() / 1000);
      let fromTimestamp = 0;
      switch (timeRange) {
        case '1D':
          fromTimestamp = now - 24 * 60 * 60;
          break;
        case '1W':
          fromTimestamp = now - 7 * 24 * 60 * 60;
          break;
        case '1M':
          fromTimestamp = now - 30 * 24 * 60 * 60;
          break;
        case 'ALL':
          fromTimestamp = 0;
          break;
      }

      try {
        console.log('[usePriceHistory] Fetching candles:', { marketId, timeframe, fromTimestamp });
        const candles = await fetchCandlesFromSubgraph(marketId, timeframe, fromTimestamp);
        console.log('[usePriceHistory] Raw candles received:', candles.length, candles.slice(0, 3));
        const pricePoints = candlesToPricePoints(candles);
        console.log('[usePriceHistory] Converted price points:', pricePoints.length, pricePoints.slice(0, 3));
        return pricePoints;
      } catch (error) {
        console.error('[usePriceHistory] Error fetching price history:', error);
        return [];
      }
    },
    enabled: !!marketId,
    refetchInterval: 60000, // Refetch every minute
  });
}

