'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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
  duration: string;
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

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
      
      const marketArray: MarketCard[] = [];
      
      for (let i = 1; i <= countNum; i++) {
        try {
          const market = await getMarket(BigInt(i));
          if (!market.exists) continue;
          
          const priceYes = parseFloat(await getPriceYes(BigInt(i)));
          const priceNo = parseFloat(await getPriceNo(BigInt(i)));
          
          const totalPairs = Number(formatUnits(market.totalPairsUSDC as bigint, 6));
          const statusNum = Number(market.status);
          const status = statusNum === 0 ? 'LIVE TRADING' : statusNum === 1 ? 'FUNDING' : 'RESOLVED';
          
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
            duration: '1D 20M',
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
    if (searchTerm && !market.question.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    if (activeCategory !== 'All') {
      const categoryLower = activeCategory.toLowerCase();
      const questionLower = market.question.toLowerCase();
      
      if (categoryLower === 'crypto') {
        return questionLower.includes('btc') || questionLower.includes('eth') || 
               questionLower.includes('crypto') || questionLower.includes('sol') ||
               questionLower.includes('xrp') || questionLower.includes('doge') ||
               questionLower.includes('bnb') || questionLower.includes('matic');
      }
      if (categoryLower === 'bitcoin') {
        return questionLower.includes('btc') || questionLower.includes('bitcoin');
      }
      if (categoryLower === 'ethereum') {
        return questionLower.includes('eth') || questionLower.includes('ethereum');
      }
      return questionLower.includes(categoryLower);
    }
    
    return true;
  });

  const totalVolume = coreUsdcBalance && typeof coreUsdcBalance === 'bigint' ? parseFloat(formatUnits(coreUsdcBalance, 6)) : 0;
  const liveMarkets = markets.filter(m => m.status === 'LIVE TRADING').length;
  const activeTraders = 234;

  const categories = ['All', 'Crypto', 'Bitcoin', 'Ethereum', 'Politics', 'Sports', 'Tech', 'Finance'];

  const getMarketIcon = (question: string) => {
    const q = question.toLowerCase();
    if (q.includes('btc') || q.includes('bitcoin')) return '₿';
    if (q.includes('eth') || q.includes('ethereum')) return 'Ξ';
    if (q.includes('sol')) return '◎';
    if (q.includes('xrp') || q.includes('ripple')) return '✕';
    if (q.includes('doge')) return '🐕';
    if (q.includes('bnb')) return '🔷';
    if (q.includes('polygon') || q.includes('matic')) return '⬟';
    return '💵';
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF]">
      <Header />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-sm font-bold text-[#14B8A6] uppercase tracking-wide">Browse Markets</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-4">
            What&apos;s the Market Thinking?
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Trade what you believe in — every market reflects real-time sentiment and liquidity.
          </p>
        </motion.div>

        {/* Stats Banner with decorative elements */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative overflow-hidden bg-gradient-to-r from-[#14B8A6] to-[#0D9488] rounded-3xl p-8 mb-12 shadow-2xl"
        >
          {/* Decorative shapes */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2"></div>
          
          {/* Live indicator badge */}
          <div className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 bg-white rounded-full"
            />
            <span className="text-sm font-bold text-white uppercase tracking-wide">Live on BSC Chain</span>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Total Volume */}
            <div className="text-center">
              <div className="text-sm font-bold text-white/80 mb-2 uppercase tracking-wider">Total Volume</div>
              <motion.div 
                key={totalVolume}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-white mb-2"
              >
                {totalVolume.toFixed(0)} BNB
              </motion.div>
              <div className="text-sm text-white/70 flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
                +12%
              </div>
            </div>

            {/* Active Traders */}
            <div className="text-center">
              <div className="text-sm font-bold text-white/80 mb-2 uppercase tracking-wider">Active Traders</div>
              <motion.div 
                key={activeTraders}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-white mb-2"
              >
                {activeTraders}
              </motion.div>
              <div className="text-sm text-white/70">+18 today</div>
            </div>

            {/* Live Markets */}
            <div className="text-center">
              <div className="text-sm font-bold text-white/80 mb-2 uppercase tracking-wider">Live Markets</div>
              <motion.div 
                key={liveMarkets}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-white mb-2"
              >
                {liveMarkets}
              </motion.div>
              <div className="text-sm text-white/70">3 closing</div>
            </div>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center gap-4 bg-white rounded-xl border-2 border-gray-200 focus-within:border-[#14B8A6] px-5 py-4 shadow-md transition-all">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search markets..."
              className="flex-grow bg-transparent outline-none text-gray-800 placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-gray-600 hover:text-[#14B8A6] px-4 py-2 rounded-lg hover:bg-gray-50 transition-all font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              More Filters
            </motion.button>
          </div>
        </motion.div>

        {/* Results count & Categories */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-8"
        >
          <p className="text-sm font-semibold text-gray-600 mb-6">
            Showing <span className="text-[#14B8A6] text-base font-bold">{filteredMarkets.length}</span> markets
          </p>

          <div className="flex flex-wrap gap-3">
            {categories.map((category, index) => (
              <motion.button
                key={category}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6 + index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-3 rounded-full text-sm font-bold transition-all ${
                  activeCategory === category
                    ? 'bg-[#14B8A6] text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
                }`}
              >
                {category}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Market Cards Grid */}
        <div>
          {loading ? (
            <div className="text-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="inline-block w-16 h-16 border-4 border-[#14B8A6] border-t-transparent rounded-full"
              />
              <p className="mt-6 text-lg font-semibold text-gray-600">Loading markets...</p>
            </div>
          ) : filteredMarkets.length === 0 ? (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-300 shadow-lg"
            >
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No markets found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSearchTerm('');
                  setActiveCategory('All');
                }}
                className="px-6 py-3 bg-[#14B8A6] text-white font-semibold rounded-lg hover:bg-[#0D9488] transition-colors"
              >
                Clear Filters
              </motion.button>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredMarkets.map((market, index) => (
                  <motion.div
                    key={market.id}
                    layout
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                  >
                    <Link href={`/markets/${market.id}`}>
                      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100 hover:border-[#14B8A6] transition-all cursor-pointer h-full">
                        {/* Icon & Question */}
                        <div className="flex items-start gap-4 mb-6">
                          <motion.div 
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                            className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center text-2xl flex-shrink-0 shadow-lg"
                          >
                            {getMarketIcon(market.question)}
                          </motion.div>
                          <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2">
                            {market.question}
                          </h3>
                        </div>

                        {/* YES/NO Buttons */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className="bg-gradient-to-br from-green-400 to-green-500 rounded-xl p-4 text-center cursor-pointer shadow-md hover:shadow-lg transition-shadow"
                          >
                            <div className="text-xs font-bold text-white/90 mb-1 uppercase tracking-wide">Yes</div>
                            <div className="text-2xl font-black text-white">
                              ${market.yesPrice.toFixed(2)}
                            </div>
                          </motion.div>
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className="bg-gradient-to-br from-red-400 to-red-500 rounded-xl p-4 text-center cursor-pointer shadow-md hover:shadow-lg transition-shadow"
                          >
                            <div className="text-xs font-bold text-white/90 mb-1 uppercase tracking-wide">No</div>
                            <div className="text-2xl font-black text-white">
                              ${market.noPrice.toFixed(2)}
                            </div>
                          </motion.div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div className="flex h-full">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${market.yesPercent}%` }}
                                transition={{ duration: 1, delay: index * 0.05 }}
                                className="bg-gradient-to-r from-green-400 to-green-500"
                              />
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${market.noPercent}%` }}
                                transition={{ duration: 1, delay: index * 0.05 }}
                                className="bg-gradient-to-r from-red-400 to-red-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Volume & Duration */}
                        <div className="flex justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
                          <div>
                            <span className="font-bold text-gray-700 uppercase tracking-wide">Volume</span>
                            <div className="font-bold text-gray-900">${market.volume.toFixed(2)}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-gray-700 uppercase tracking-wide">Duration</span>
                            <div className="font-bold text-gray-900">{market.duration}</div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12 mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/markets" className="hover:text-[#14B8A6] transition-colors">Markets</Link></li>
                <li><Link href="/admin" className="hover:text-[#14B8A6] transition-colors">Create Market</Link></li>
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Governance</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-[#14B8A6] transition-colors">Security</a></li>
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