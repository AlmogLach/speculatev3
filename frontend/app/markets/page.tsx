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
}

export default function MarketsPage() {
  const [marketCount, setMarketCount] = useState<number | null>(null);
  const [markets, setMarkets] = useState<MarketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

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
    if (q.includes('1inch')) return '1';
    return '💵';
  };

  return (
    <div className="min-h-screen bg-[#FAF9FF] relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#14B8A6]/20 to-purple-400/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-[#14B8A6]/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, -90, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </div>

      <Header />

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <Link href="/" className="inline-flex items-center text-[#14B8A6] text-sm font-semibold mb-4 hover:text-[#0D9488] transition-colors group">
            <motion.span 
              className="mr-2 group-hover:-translate-x-1 transition-transform"
            >
              ←
            </motion.span>
            BACK TO HOME
          </Link>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-[#14B8A6] to-[#0D9488] bg-clip-text text-transparent">
              Turn Conviction Into Capital
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Explore prediction markets across every category. When you know what&apos;s coming, trade it.
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <motion.div 
            whileHover={{ y: -5, scale: 1.02 }}
            className="relative overflow-hidden bg-gradient-to-br from-[#14B8A6] to-[#0D9488] rounded-2xl p-6 shadow-xl"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80 mb-1 font-semibold uppercase tracking-wide">Total Volume</p>
                <motion.p 
                  key={totalVolume}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl md:text-4xl font-black text-white"
                >
                  ${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </motion.p>
                <p className="text-xs text-white/70 mt-2 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                  +12% this week
                </p>
              </div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm"
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </motion.div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5, scale: 1.02 }}
            className="relative overflow-hidden bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1 font-semibold uppercase tracking-wide">Active Traders</p>
                <motion.p 
                  key={activeTraders}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl md:text-4xl font-black text-gray-900"
                >
                  {activeTraders}
                </motion.p>
                <p className="text-xs text-gray-500 mt-2 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                  +18 today
                </p>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-[#14B8A6]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5, scale: 1.02 }}
            className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 shadow-xl"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80 mb-1 font-semibold uppercase tracking-wide">Live Markets</p>
                <motion.p 
                  key={liveMarkets}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl md:text-4xl font-black text-white"
                >
                  {liveMarkets}
                </motion.p>
                <p className="text-xs text-white/70 mt-2 flex items-center">
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-white rounded-full mr-2"
                  />
                  3 closing soon
                </p>
              </div>
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          </motion.div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center bg-white rounded-xl border-2 border-gray-200 focus-within:border-[#14B8A6] px-5 py-4 mb-6 shadow-lg transition-all">
            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search markets by keyword..."
              className="flex-grow bg-transparent outline-none text-gray-800 placeholder-gray-400 text-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between mb-6">
            <motion.p 
              key={filteredMarkets.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-semibold text-gray-600"
            >
              Showing <span className="text-[#14B8A6] text-lg font-bold">{filteredMarkets.length}</span> markets
            </motion.p>
          </div>

          <div className="flex flex-wrap gap-3">
            {categories.map((category, index) => (
              <motion.button
                key={category}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(category)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-md ${
                  activeCategory === category
                    ? 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {category}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Market Cards Grid */}
        <div id="markets">
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
                    whileHover={{ y: -10, scale: 1.02 }}
                  >
                    <Link href={`/markets/${market.id}`}>
                      <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-[#14B8A6] transition-all cursor-pointer h-full">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-5">
                          <motion.div 
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.5 }}
                            className="w-14 h-14 bg-gradient-to-br from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-xl flex items-center justify-center text-3xl border border-[#14B8A6]/20"
                          >
                            {getMarketIcon(market.question)}
                          </motion.div>
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-md ${
                            market.status === 'LIVE TRADING' 
                              ? 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white' 
                              : market.status === 'FUNDING'
                              ? 'bg-gradient-to-r from-green-400 to-green-500 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {market.status === 'LIVE TRADING' && (
                              <motion.span
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="inline-block w-2 h-2 bg-white rounded-full mr-2"
                              />
                            )}
                            {market.status}
                          </span>
                        </div>

                        {/* Question */}
                        <h3 className="text-lg font-bold text-gray-900 mb-5 line-clamp-2 group-hover:text-[#14B8A6] transition-colors min-h-[3.5rem]">
                          {market.question}
                        </h3>
                        
                        {/* Yes/No Prices */}
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className="bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl p-4 border border-green-200 text-center transition-all cursor-pointer shadow-sm hover:shadow-md"
                          >
                            <div className="text-xs font-bold text-green-600 mb-2 uppercase tracking-wide">YES</div>
                            <div className="text-2xl font-black text-green-700">{market.yesPrice.toFixed(2)}</div>
                            <div className="text-xs text-green-600 mt-1 font-semibold">Price</div>
                          </motion.div>
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className="bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-xl p-4 border border-red-200 text-center transition-all cursor-pointer shadow-sm hover:shadow-md"
                          >
                            <div className="text-xs font-bold text-red-600 mb-2 uppercase tracking-wide">NO</div>
                            <div className="text-2xl font-black text-red-700">{market.noPrice.toFixed(2)}</div>
                            <div className="text-xs text-red-600 mt-1 font-semibold">Price</div>
                          </motion.div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-5">
                          <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                            <span>Market Sentiment</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
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

                        {/* Volume */}
                        <div className="pt-4 border-t border-gray-100">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-bold text-gray-500 uppercase tracking-wide text-xs">Volume</span>
                              <div className="text-lg font-black text-gray-900 mt-1">
                                ${market.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              className="w-10 h-10 bg-[#14B8A6]/10 rounded-lg flex items-center justify-center group-hover:bg-[#14B8A6] transition-colors"
                            >
                              <svg className="w-5 h-5 text-[#14B8A6] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </motion.div>
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
      <footer className="relative z-10 bg-white border-t border-gray-200 py-12 mt-20">
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