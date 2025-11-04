'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import Header from '@/components/Header';
import { getMarketCount, getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { formatUnits } from 'viem';

interface Market {
  id: number;
  question: string;
  status: 'active' | 'paused' | 'resolved';
  totalPairs: number;
  priceYes: string | null;
  priceNo: string | null;
  reserveYes: number;
  reserveNo: number;
  feeBps?: number;
}

export default function MarketsPage() {
  const { isConnected } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'resolved'>('all');

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    try {
      const count = await getMarketCount();
      const marketArray: Market[] = [];
      
      for (let i = 1; i <= Number(count); i++) {
        try {
          const market: any = await getMarket(BigInt(i));
          const statusNames = ['active', 'paused', 'resolved'] as const;
          
          const status = market.status !== undefined 
            ? statusNames[Number(market.status)] 
            : 'active';
          
          // Get prices
          let priceYes: string | null = null;
          let priceNo: string | null = null;
          try {
            priceYes = await getPriceYes(BigInt(i));
            priceNo = await getPriceNo(BigInt(i));
          } catch (err) {
            console.error(`Error loading prices for market ${i}:`, err);
          }
          
          marketArray.push({
            id: i,
            question: market.question as string || 'Unknown Market',
            status: status as 'active' | 'paused' | 'resolved',
            totalPairs: Number(formatUnits((market.totalPairs as bigint) || 0n, 6)),
            priceYes,
            priceNo,
            reserveYes: Number(formatUnits((market.reserveYes as bigint) || 0n, 18)),
            reserveNo: Number(formatUnits((market.reserveNo as bigint) || 0n, 18)),
            feeBps: market.feeBps ? Number(market.feeBps) : undefined,
          });
        } catch (err) {
          console.error(`Error loading market ${i}:`, err);
        }
      }
      
      setMarkets(marketArray);
    } catch (error) {
      console.error('Error loading markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMarkets = markets.filter(m => filter === 'all' || m.status === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Markets</h1>
          <p className="text-lg text-gray-600">Trade on prediction markets with instant liquidity</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {(['all', 'active', 'paused', 'resolved'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filter === status
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
                  {markets.filter(m => m.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>
        
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No markets yet' : `No ${filter} markets`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' 
                ? 'Be the first to create a prediction market!'
                : `There are no ${filter} markets at the moment.`}
            </p>
            {isConnected && filter === 'all' && (
              <Link
                href="/admin"
                className="inline-block rounded-md bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-green-500 transition-all"
              >
                Create Market →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMarkets.map((market) => (
              <Link key={market.id} href={`/markets/${market.id}`}>
                <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer transform hover:-translate-y-1">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      market.status === 'active' ? 'bg-green-100 text-green-700' :
                      market.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {market.status ? (market.status.charAt(0).toUpperCase() + market.status.slice(1)) : 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500">#{market.id}</span>
                  </div>

                  {/* Question */}
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 line-clamp-2 group-hover:text-green-600 transition-colors">
                    {market.question}
                  </h2>

                  {/* Prices */}
                  {market.priceYes !== null && market.priceNo !== null && (
                    <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-green-50 to-red-50">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-700">YES</span>
                          <div className="flex flex-col">
                            <span className="font-bold text-green-600">
                              {parseFloat(market.priceYes).toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </span>
                            <span className="text-xs text-green-600/70">
                              ${parseFloat(market.priceYes).toFixed(3)} USD
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-red-700">NO</span>
                          <div className="flex flex-col">
                            <span className="font-bold text-red-600">
                              {parseFloat(market.priceNo).toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </span>
                            <span className="text-xs text-red-600/70">
                              ${parseFloat(market.priceNo).toFixed(3)} USD
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-gray-50 p-2">
                      <div className="text-xs text-gray-600 mb-1">Vault</div>
                      <div className="font-semibold text-gray-900">
                        {market.totalPairs.toLocaleString()} USDC
                      </div>
                    </div>
                    <div className="rounded-md bg-gray-50 p-2">
                      <div className="text-xs text-gray-600 mb-1">Fee Rate</div>
                      <div className="font-semibold text-gray-900">
                        {market.feeBps ? `${(market.feeBps / 100).toFixed(2)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* View Market Link */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm font-medium text-green-600 group-hover:text-green-700">
                      <span>View Market</span>
                      <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
