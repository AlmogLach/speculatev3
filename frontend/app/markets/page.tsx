'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { getMarketCount, getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { addresses } from '@/lib/contracts';
import { usdcAbi } from '@/lib/abis';

interface MarketCard {
  id: number;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  yesPercent: number;
  noPercent: number;
  status: 'LIVE TRADING' | 'FUNDING' | 'RESOLVED';
  totalPairsUSDC: bigint;
}

export default function MarketsPage() {
  const [marketCount, setMarketCount] = useState<number | null>(null);
  const [markets, setMarkets] = useState<MarketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Get total volume from USDC balance of SpeculateCore contract
  const { data: coreUsdcBalance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [addresses.core],
    query: {
      enabled: true,
    },
  });

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    try {
      const count = await getMarketCount();
      const countNum = Number(count);
      setMarketCount(countNum);
      
      const marketArray: MarketCard[] = [];
      
      // Load ALL markets from the contract
      for (let i = 1; i <= countNum; i++) {
        try {
          const market = await getMarket(BigInt(i));
          if (!market.exists) continue;
          
          const priceYes = parseFloat(await getPriceYes(BigInt(i)));
          const priceNo = parseFloat(await getPriceNo(BigInt(i)));
          
          const totalPairs = Number(formatUnits(market.totalPairsUSDC as bigint, 6));
          const statusNum = Number(market.status);
          const status = statusNum === 0 ? 'LIVE TRADING' : statusNum === 1 ? 'FUNDING' : 'RESOLVED';
          
          // Calculate percentages based on reserves
          const reserveYes = Number(formatUnits(market.reserveYes as bigint, 18));
          const reserveNo = Number(formatUnits(market.reserveNo as bigint, 18));
          const totalReserve = reserveYes + reserveNo;
          
          let yesPercent = 50;
          let noPercent = 50;
          if (totalReserve > 0) {
            yesPercent = Math.round((reserveYes / totalReserve) * 100);
            noPercent = Math.round((reserveNo / totalReserve) * 100);
          }
          
          marketArray.push({
            id: i,
            question: market.question as string,
            yesPrice: priceYes,
            noPrice: priceNo,
            volume: totalPairs,
            yesPercent,
            noPercent,
            status,
            totalPairsUSDC: market.totalPairsUSDC as bigint,
          });
        } catch (error) {
          console.error(`Error loading market ${i}:`, error);
        }
      }
      
      setMarkets(marketArray);
    } catch (error) {
      console.error('Error loading markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMarkets = markets.filter(market => {
    // Search filter
    if (searchTerm && !market.question.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Category filter (simple keyword matching)
    if (activeCategory !== 'All') {
      const categoryLower = activeCategory.toLowerCase();
      const questionLower = market.question.toLowerCase();
      
      if (categoryLower === 'crypto') {
        return questionLower.includes('btc') || questionLower.includes('eth') || 
               questionLower.includes('crypto') || questionLower.includes('sol') ||
               questionLower.includes('xrp') || questionLower.includes('doge') ||
               questionLower.includes('bnb') || questionLower.includes('matic');
      }
      return questionLower.includes(categoryLower);
    }
    
    return true;
  });

  const totalVolume = coreUsdcBalance && typeof coreUsdcBalance === 'bigint' ? parseFloat(formatUnits(coreUsdcBalance, 6)) : 0;
  const liveMarkets = markets.filter(m => m.status === 'LIVE TRADING').length;
  const activeTraders = 234; // Placeholder - would need to track from events

  const categories = ['All', 'Crypto', 'Bitcoin', 'Ethereum', 'Politics', 'Sports', 'Tech', 'Finance'];

  return (
    <div className="min-h-screen bg-[#FAF9FF]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <Link href="#markets" className="inline-flex items-center text-[#14B8A6] text-sm font-semibold mb-4">
            <span className="mr-1">↑</span> BROWSE MARKETS
          </Link>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">What&apos;s the Market Thinking?</h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Trade what you believe in every market reflects real-time sentiment and liquidity.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 shadow-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">TOTAL VOLUME</p>
                <p className="text-3xl font-bold text-green-800">{totalVolume.toFixed(2)} USDC</p>
                <p className="text-xs text-green-600 mt-1">+12%</p>
              </div>
              <div className="w-16 h-16 bg-green-200 rounded-lg opacity-50"></div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">ACTIVE TRADERS</p>
                <p className="text-3xl font-bold text-gray-900">{activeTraders}</p>
                <p className="text-xs text-gray-500 mt-1">+18 today</p>
              </div>
              <div className="w-16 h-16 bg-gray-200 rounded-lg opacity-50"></div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 shadow-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">LIVE MARKETS</p>
                <p className="text-3xl font-bold text-green-800">{liveMarkets}</p>
                <p className="text-xs text-green-600 mt-1">3 closing</p>
              </div>
              <div className="w-16 h-16 bg-green-200 rounded-lg opacity-50"></div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex items-center bg-white rounded-lg border border-gray-300 px-4 py-3 mb-4 shadow-sm">
            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search markets..."
              className="flex-grow bg-transparent outline-none text-gray-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="flex items-center text-gray-600 hover:text-gray-800 ml-4 px-3 py-1 rounded-md hover:bg-gray-100">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              More Filters
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">Showing {filteredMarkets.length} markets</p>

          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-[#14B8A6] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Market Cards Grid */}
        <div id="markets">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#14B8A6]"></div>
              <p className="mt-4 text-gray-600">Loading markets...</p>
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No markets found</h3>
              <p className="text-gray-600">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMarkets.map((market) => (
                <Link key={market.id} href={`/markets/${market.id}`}>
                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow cursor-pointer">
                    {/* Asset Icon Placeholder */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">
                          {market.question.includes('BTC') || market.question.includes('Bitcoin') ? '₿' :
                           market.question.includes('ETH') || market.question.includes('Ethereum') ? 'Ξ' :
                           market.question.includes('Sol') ? '◎' :
                           market.question.includes('XRP') || market.question.includes('Ripple') ? '✕' :
                           market.question.includes('Doge') ? '🐕' :
                           market.question.includes('BNB') ? '🔷' :
                           market.question.includes('Polygon') || market.question.includes('MATIC') ? '⬟' :
                           market.question.includes('1inch') ? '1' : '💵'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        market.status === 'LIVE TRADING' 
                          ? 'bg-[#14B8A6] text-white' 
                          : market.status === 'FUNDING'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {market.status}
                      </span>
                    </div>

                    {/* Question */}
                    <h3 className="text-lg font-bold text-gray-900 mb-4 line-clamp-2">{market.question}</h3>
                    
                    {/* Yes/No Buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button className="bg-green-50 hover:bg-green-100 rounded-lg p-3 border border-green-200 text-left transition-colors">
                        <div className="text-xs text-gray-600 mb-1">YES</div>
                        <div className="text-lg font-bold text-green-700">${market.yesPrice.toFixed(3)}</div>
                      </button>
                      <button className="bg-red-50 hover:bg-red-100 rounded-lg p-3 border border-red-200 text-left transition-colors">
                        <div className="text-xs text-gray-600 mb-1">NO</div>
                        <div className="text-lg font-bold text-red-700">${market.noPrice.toFixed(3)}</div>
                      </button>
                    </div>

                    {/* Volume Bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="flex h-full">
                          <div 
                            className="bg-[#14B8A6]" 
                            style={{ width: `${market.yesPercent}%` }}
                          ></div>
                          <div 
                            className="bg-red-300" 
                            style={{ width: `${market.noPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Volume and Duration */}
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div>
                        <span className="font-semibold">VOLUME</span>
                        <span className="ml-2">${market.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="font-semibold">DURATIONS</span>
                        <span className="ml-2">1D 20M</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#FAF9FF] border-t border-gray-200 py-12 mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/markets" className="hover:text-[#14B8A6]">Markets</Link></li>
                <li><Link href="/admin" className="hover:text-[#14B8A6]">Create Market</Link></li>
                <li><a href="#" className="hover:text-[#14B8A6]">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-[#14B8A6]">Documentation</a></li>
                <li><a href="#" className="hover:text-[#14B8A6]">FAQ</a></li>
                <li><a href="#" className="hover:text-[#14B8A6]">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-[#14B8A6]">Discord</a></li>
                <li><a href="#" className="hover:text-[#14B8A6]">Twitter</a></li>
                <li><a href="#" className="hover:text-[#14B8A6]">Governance</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-[#14B8A6]">Privacy</a></li>
                <li><a href="#" className="hover:text-[#14B8A6]">Terms</a></li>
                <li><a href="#" className="hover:text-[#14B8A6]">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">© 2025 SpeculateX. All rights reserved.</p>
            <p className="text-sm text-gray-500 mt-2 md:mt-0">Built for the decentralized web</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
