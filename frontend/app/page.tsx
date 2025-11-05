'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getMarketCount, getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { useReadContract } from 'wagmi';
import { addresses } from '@/lib/contracts';
import { usdcAbi } from '@/lib/abis';
import { formatUnits } from 'viem';

interface Market {
  id: number;
  question: string;
  priceYes: string;
  priceNo: string;
  volume: number;
}

export default function Home() {
  const [marketCount, setMarketCount] = useState<number>(0);
  const [traders, setTraders] = useState<number>(3800);
  const [liveMarkets, setLiveMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: coreUsdcBalance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [addresses.core],
  });

  useEffect(() => {
    loadData();
    // Animate traders count
    const interval = setInterval(() => {
      setTraders(prev => prev + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const count = await getMarketCount();
      const countNum = Number(count);
      setMarketCount(countNum);

      // Load first 3 markets for preview
      const markets: Market[] = [];
      const limit = Math.min(countNum, 3);
      
      for (let i = 1; i <= limit; i++) {
        try {
          const market: any = await getMarket(BigInt(i));
          const priceYes = await getPriceYes(BigInt(i));
          const priceNo = await getPriceNo(BigInt(i));
          const volume = Number(formatUnits((market.totalPairs as bigint) || 0n, 6));
          
          markets.push({
            id: i,
            question: market.question as string,
            priceYes: priceYes || '0.5',
            priceNo: priceNo || '0.5',
            volume,
          });
        } catch (err) {
          console.error(`Error loading market ${i}:`, err);
        }
      }
      
      setLiveMarkets(markets);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalVolume = coreUsdcBalance && typeof coreUsdcBalance === 'bigint' 
    ? parseFloat(formatUnits(coreUsdcBalance, 6)) 
    : 0;

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-[#F5F0FF] relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated gradient blobs */}
        <motion.div 
          className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-[#14B8A6] to-[#0D9488] rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-purple-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, -50, 0],
            y: [0, 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
        <motion.div 
          className="absolute bottom-0 left-1/2 w-[550px] h-[550px] bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 4
          }}
        />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: 'radial-gradient(circle, #14B8A6 1.5px, transparent 1.5px)',
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Radial glow behind hero */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-[#14B8A6]/20 to-transparent blur-3xl pointer-events-none"></div>

      {/* Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 border-b border-white/20 backdrop-blur-md bg-white/40"
      >
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.5 }}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#14B8A6] to-[#0D9488] flex items-center justify-center shadow-lg"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </motion.div>
              <span className="text-2xl font-bold text-gray-900">SpeculateX</span>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/markets"
                className="rounded-full bg-[#14B8A6] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0D9488] transition-all shadow-lg hover:shadow-xl"
              >
                Launch App
              </Link>
            </motion.div>
          </div>
        </nav>
      </motion.header>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center max-w-4xl mx-auto">
            {/* Beta Badge with shimmer */}
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mb-8 inline-flex"
            >
              <div className="relative inline-flex items-center h-10 px-5 rounded-full border-2 border-[#14B8A6]/30 bg-white/80 backdrop-blur-sm shadow-lg overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  animate={{ x: [-200, 200] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2.5 h-2.5 rounded-full bg-[#14B8A6] mr-3"
                />
                <span className="relative z-10 text-sm font-bold text-[#14B8A6] uppercase tracking-wider">Beta Live</span>
              </div>
            </motion.div>

            {/* Main Heading with gradient */}
            <motion.h1 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-6xl sm:text-7xl md:text-8xl font-black leading-[1] mb-8 tracking-tight"
            >
              <span className="text-gray-900">Profit from the</span>
              <span className="block mt-3 bg-gradient-to-r from-[#14B8A6] via-[#0D9488] to-[#14B8A6] bg-clip-text text-transparent animate-gradient">
                Curve Wars
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              Trade on crypto market predictions with instant liquidity and zero slippage. 
              <span className="block mt-2">Bet YES or NO on real-world outcomes.</span>
            </motion.p>

            {/* CTA Buttons */}
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/markets"
                  className="group relative inline-flex items-center justify-center h-16 px-10 rounded-full bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-lg font-bold text-white shadow-xl overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-[#0D9488] to-[#14B8A6]"
                    initial={{ x: '100%' }}
                    whileHover={{ x: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                  <span className="relative z-10 flex items-center">
                    Launch Dapp
                    <svg className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  {/* Glow effect */}
                  <div className="absolute inset-0 blur-xl bg-[#14B8A6]/50 group-hover:bg-[#14B8A6]/70 transition-all -z-10"></div>
                </Link>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/markets"
                  className="inline-flex items-center justify-center h-16 px-10 rounded-full border-2 border-gray-300 bg-white/80 backdrop-blur-sm text-lg font-bold text-gray-900 hover:border-[#14B8A6] hover:bg-white transition-all shadow-lg hover:shadow-xl"
                >
                  Explore Markets
                </Link>
              </motion.div>
            </motion.div>

            {/* Stats Grid with animated counters */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-16"
            >
              {/* Active Markets */}
              <motion.div 
                whileHover={{ y: -5, scale: 1.02 }}
                className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 hover:border-[#14B8A6] transition-all shadow-lg hover:shadow-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#14B8A6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Markets</div>
                    <motion.div 
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center group-hover:bg-[#14B8A6]/20 transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#14B8A6]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                      </svg>
                    </motion.div>
                  </div>
                  <motion.div 
                    key={marketCount}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl font-black text-[#14B8A6] mb-1"
                  >
                    {marketCount || '24'}
                  </motion.div>
                  <div className="text-sm text-gray-500">Live trading</div>
                </div>
              </motion.div>

              {/* Total Volume */}
              <motion.div 
                whileHover={{ y: -5, scale: 1.02 }}
                className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 hover:border-[#14B8A6] transition-all shadow-lg hover:shadow-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#14B8A6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Volume</div>
                    <motion.div 
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center group-hover:bg-[#14B8A6]/20 transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#14B8A6]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                      </svg>
                    </motion.div>
                  </div>
                  <div className="text-4xl font-black text-[#14B8A6] mb-1">
                    {formatVolume(totalVolume) || '$8.2M'}
                  </div>
                  <div className="text-sm text-gray-500">All time</div>
                </div>
              </motion.div>

              {/* Traders Active */}
              <motion.div 
                whileHover={{ y: -5, scale: 1.02 }}
                className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 hover:border-[#14B8A6] transition-all shadow-lg hover:shadow-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#14B8A6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Traders</div>
                    <motion.div 
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center group-hover:bg-[#14B8A6]/20 transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#14B8A6]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                    </motion.div>
                  </div>
                  <motion.div 
                    key={traders}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-black text-[#14B8A6] mb-1"
                  >
                    {formatNumber(traders)}
                  </motion.div>
                  <div className="text-sm text-gray-500">Active users</div>
                </div>
              </motion.div>

              {/* Trading Fee */}
              <motion.div 
                whileHover={{ y: -5, scale: 1.02 }}
                className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 hover:border-[#14B8A6] transition-all shadow-lg hover:shadow-2xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#14B8A6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trading Fee</div>
                    <motion.div 
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                      className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center group-hover:bg-[#14B8A6]/20 transition-colors"
                    >
                      <svg className="w-4 h-4 text-[#14B8A6]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </motion.div>
                  </div>
                  <div className="text-4xl font-black text-[#14B8A6] mb-1">0.5%</div>
                  <div className="text-sm text-gray-500">Ultra low</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Feature Pills */}
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              {[
                'Instant Settlement',
                'Oracle Verified',
                'Non-Custodial',
                'CPMM Powered'
              ].map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1.2 + index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 shadow-lg hover:border-[#14B8A6] hover:shadow-xl transition-all"
                >
                  <svg className="w-5 h-5 text-[#14B8A6]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-700">{feature}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* How It Works Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20"
        >
          <div className="text-center mb-12">
            <motion.div 
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              className="inline-block text-sm font-bold text-[#14B8A6] uppercase tracking-wider mb-3"
            >
              How It Works
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Start Trading in 3 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Create or Join',
                description: 'Browse active markets or create your own prediction market',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )
              },
              {
                step: '2',
                title: 'Choose YES / NO',
                description: 'Place your bet on the outcome you believe will happen',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              },
              {
                step: '3',
                title: 'Earn Rewards',
                description: 'Win rewards when your prediction is correct',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ y: -10 }}
                className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-100 shadow-lg hover:shadow-2xl transition-all"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#14B8A6] to-[#0D9488] rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl">
                    {item.icon}
                  </div>
                  <div className="text-5xl font-black text-[#14B8A6]/20 absolute top-4 right-6">
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Live Markets Preview */}
        {liveMarkets.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20"
          >
            <div className="text-center mb-12">
              <motion.div 
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                className="inline-block text-sm font-bold text-[#14B8A6] uppercase tracking-wider mb-3"
              >
                Live Markets
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Active Prediction Markets
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Trade on live markets with real-time pricing and instant execution
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {liveMarkets.map((market, index) => (
                <motion.div
                  key={market.id}
                  initial={{ y: 50, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100 shadow-lg hover:shadow-2xl transition-all hover:border-[#14B8A6]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Trading</div>
                    <div className="px-2.5 py-1 rounded-full bg-[#14B8A6]/10 text-[#14B8A6] text-xs font-semibold">
                      Finance
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 text-lg mb-4 line-clamp-2">
                    {market.question}
                  </h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-600">YES</span>
                      <span className="text-2xl font-black text-[#14B8A6]">
                        ${parseFloat(market.priceYes).toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-600">NO</span>
                      <span className="text-2xl font-black text-red-500">
                        ${parseFloat(market.priceNo).toFixed(3)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>YES {(parseFloat(market.priceYes) * 100).toFixed(1)}%</span>
                      <span>NO {(parseFloat(market.priceNo) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${parseFloat(market.priceYes) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-[#14B8A6] to-[#0D9488]"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-4">
                    Volume: <span className="font-semibold text-gray-700">{formatVolume(market.volume)}</span>
                  </div>

                  <Link href={`/markets/${market.id}`}>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full rounded-xl bg-[#14B8A6] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0D9488] transition-colors shadow-lg"
                    >
                      Trade Market
                    </motion.button>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/markets"
                  className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-base font-bold text-white shadow-xl hover:shadow-2xl transition-all"
                >
                  View All Markets
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20 backdrop-blur-sm bg-white/30 py-8 mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">© 2025 SpeculateX. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <a href="#" className="hover:text-[#14B8A6] transition-colors">Docs</a>
              <a href="#" className="hover:text-[#14B8A6] transition-colors">Twitter</a>
              <a href="#" className="hover:text-[#14B8A6] transition-colors">Discord</a>
              <a href="#" className="hover:text-[#14B8A6] transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}