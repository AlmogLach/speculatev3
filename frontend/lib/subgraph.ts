// Subgraph client for SpeculateCore
export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function graphRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
  if (!SUBGRAPH_URL) {
    console.warn('SUBGRAPH_URL not configured. Please set NEXT_PUBLIC_SUBGRAPH_URL in .env.local');
    throw new Error('SUBGRAPH_URL not configured');
  }

  console.log('GraphQL Request:', { url: SUBGRAPH_URL, query, variables });

  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GraphQLResponse<T>;
  console.log('GraphQL Response:', { status: res.status, data: json.data, errors: json.errors });
  
  if (!res.ok || json.errors) {
    console.error('GraphQL Error:', {
      status: res.status,
      errors: json.errors,
      query,
      variables,
    });
    throw new Error(json.errors?.[0]?.message || `GraphQL error (${res.status})`);
  }

  return json.data as T;
}

// Types
export type TradeGql = {
  id: string;
  user: string;
  type: string;
  sideYes: boolean;
  isBuy: boolean;
  usdcAmount: string;
  tokenAmount: string;
  priceE6: string;
  timestamp: string;
  blockNumber: string;
  txHash: string;
};

export type HolderGql = {
  id: string;
  user: string;
  sideYes: boolean;
  balance: string;
  totalBought: string;
  totalSold: string;
  totalSpent: string;
  totalReceived: string;
};

export type CandleGql = {
  id: string;
  timeframe: string;
  startTimestamp: string;
  openYES: string;
  highYES: string;
  lowYES: string;
  closeYES: string;
  openNO: string;
  highNO: string;
  lowNO: string;
  closeNO: string;
  volume: string;
  trades: string;
};

// Fetch transactions for a market
export async function fetchTransactionsFromSubgraph(
  marketId: number,
  limit = 100
): Promise<TradeGql[]> {
  const query = `
    query Trades($marketId: BigInt!, $limit: Int!) {
      trades(
        first: $limit,
        orderBy: timestamp,
        orderDirection: desc,
        where: { marketId: $marketId }
      ) {
        id
        user
        type
        sideYes
        isBuy
        usdcAmount
        tokenAmount
        priceE6
        timestamp
        blockNumber
        txHash
      }
    }
  `;

  try {
    console.log('Fetching transactions from subgraph for marketId:', marketId);
    const data = await graphRequest<{ trades?: TradeGql[] }>(query, {
      marketId: marketId.toString(),
      limit,
    });
    console.log('Subgraph returned trades:', data?.trades?.length || 0, data?.trades);
    return data?.trades || [];
  } catch (error) {
    console.error('Error fetching transactions from subgraph:', error);
    return [];
  }
}

// Fetch top holders for a market
export async function fetchTopHoldersFromSubgraph(
  marketId: number,
  sideYes: boolean,
  limit = 20
): Promise<HolderGql[]> {
  const query = `
    query Holders($marketId: BigInt!, $sideYes: Boolean!, $limit: Int!) {
      holders(
        first: $limit,
        orderBy: balance,
        orderDirection: desc,
        where: { marketId: $marketId, sideYes: $sideYes, balance_gt: "0" }
      ) {
        id
        user
        sideYes
        balance
        totalBought
        totalSold
        totalSpent
        totalReceived
      }
    }
  `;

  try {
    const data = await graphRequest<{ holders?: HolderGql[] }>(query, {
      marketId: marketId.toString(),
      sideYes,
      limit,
    });
    return data?.holders || [];
  } catch (error) {
    console.error('Error fetching holders from subgraph:', error);
    return [];
  }
}

// Fetch candles for price history
export async function fetchCandlesFromSubgraph(
  marketId: number,
  timeframe: '5m' | '1h' | '1d',
  fromTimestamp: number
): Promise<CandleGql[]> {
  const query = `
    query Candles($marketId: BigInt!, $timeframe: String!, $fromTimestamp: BigInt!) {
      candles(
        first: 500,
        orderBy: startTimestamp,
        orderDirection: asc,
        where: {
          marketId: $marketId,
          timeframe: $timeframe,
          startTimestamp_gte: $fromTimestamp
        }
      ) {
        id
        timeframe
        startTimestamp
        openYES
        highYES
        lowYES
        closeYES
        openNO
        highNO
        lowNO
        closeNO
        volume
        trades
      }
    }
  `;

  try {
    const data = await graphRequest<{ candles?: CandleGql[] }>(query, {
      marketId: marketId.toString(),
      timeframe,
      fromTimestamp: fromTimestamp.toString(),
    });
    return data?.candles || [];
  } catch (error) {
    console.error('Error fetching candles from subgraph:', error);
    return [];
  }
}

// Fetch unique active traders count
export async function fetchUniqueTradersCount(): Promise<number> {
  const query = `
    query UniqueTraders {
      trades(
        first: 1000,
        orderBy: timestamp,
        orderDirection: desc
      ) {
        user
      }
    }
  `;

  try {
    const data = await graphRequest<{ trades?: { user: string }[] }>(query);
    if (!data?.trades) return 0;
    
    // Get unique user addresses
    const uniqueTraders = new Set(data.trades.map(trade => trade.user.toLowerCase()));
    return uniqueTraders.size;
  } catch (error) {
    console.error('Error fetching unique traders from subgraph:', error);
    return 0;
  }
}

