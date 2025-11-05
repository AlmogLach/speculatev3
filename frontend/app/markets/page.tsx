'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, SlidersHorizontalIcon } from 'lucide-react';
import Header from '@/components/Header';
import { Badge, Button, Card, CardContent, Input } from '@/components/ui';
import { getMarketCount, getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { formatUnits } from 'viem';
import { useReadContract } from 'wagmi';
import { addresses } from '@/lib/contracts';
import { usdcAbi } from '@/lib/abis';

// Helper function to format price in cents
const formatPriceInCents = (price: number): string => {
  const cents = price * 100;
  if (cents >= 100) {
    return `$${cents.toFixed(2)}`;
  }
  const formatted = cents.toFixed(1).replace(/\.0$/, '');
  return `${formatted}¢`;
};

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
    <div className="min-h-screen bg-[#f5f0ff] relative overflow-hidden">
      {/* Animated Background - Figma inspired */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#14B8A6]/10 to-purple-400/10 rounded-full blur-3xl"
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
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-[#14B8A6]/10 rounded-full blur-3xl"
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

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        {/* Header Section - Figma Design */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6 translate-y-[-1rem] animate-fade-in opacity-0">
            <svg className="w-5 h-5 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="[font-family:'Geist',Helvetica] font-semibold text-[#14B8A6] text-sm tracking-[0.35px] leading-5">
              BROWSE MARKETS
            </div>
          </div>
          <h1 className="[font-family:'Geist',Helvetica] font-bold text-[#0f0a2e] text-6xl tracking-[0] leading-[60px] mb-6 translate-y-[-1rem] animate-fade-in opacity-0 [--animation-delay:200ms]">
            What&apos;s the Market Thinking?
          </h1>
          <p className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-lg tracking-[0] leading-7 mb-8 max-w-[668px] translate-y-[-1rem] animate-fade-in opacity-0 [--animation-delay:400ms]">
            Trade what you believe in every market reflects real-time sentiment and liquidity.
          </p>
        </div>

        {/* Stats Banner - Figma Design with Logo Patterns */}
        <div className="relative overflow-hidden bg-[#ffffffcc] rounded-2xl border-2 border-[#14B8A6] shadow-lg mb-12 translate-y-[-1rem] animate-fade-in opacity-0 [--animation-delay:600ms]">
          {/* Left Logo */}
          <div className="absolute left-0 top-0 w-[182px] h-[155px] pointer-events-none flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="SpeculateX Logo"
              width={182}
              height={155}
              className="object-contain w-full h-full"
              unoptimized
            />
          </div>

          {/* Stats Content */}
          <div className="relative z-10 flex items-center justify-center gap-16 md:gap-24 lg:gap-32 px-8 py-7 flex-wrap min-h-[155px]">
            {/* Total Volume */}
            <div className="flex flex-col items-center gap-4">
              <div className="font-inter text-gray-500 text-[11px] text-center tracking-[0.55px] leading-[17.6px] uppercase">
                TOTAL VOLUME
              </div>
              <div className="font-inter text-[#0a0e17] text-[32px] text-center tracking-[0] leading-[38.4px]">
                {totalVolume.toFixed(0)} BNB
              </div>
              <div className="font-inter font-bold text-[#00d1b2] text-xs text-center tracking-[0] leading-[19.2px]">
                +12%
              </div>
            </div>

            {/* Active Traders */}
            <div className="flex flex-col items-center gap-4">
              <div className="font-inter text-gray-500 text-[11px] text-center tracking-[0.55px] leading-[17.6px] uppercase">
                ACTIVE TRADERS
              </div>
              <div className="font-inter text-[#0a0e17] text-[32px] text-center tracking-[0] leading-[38.4px]">
                {activeTraders}
              </div>
              <div className="font-inter font-bold text-[#00d1b2] text-xs text-center tracking-[0] leading-[19.2px]">
                +18 today
              </div>
            </div>

            {/* Live Markets */}
            <div className="flex flex-col items-center gap-4">
              <div className="font-inter text-gray-500 text-[11px] text-center tracking-[0.55px] leading-[17.6px] uppercase">
                LIVE MARKETS
              </div>
              <div className="font-inter text-[#0a0e17] text-[32px] text-center tracking-[0] leading-[38.4px]">
                {liveMarkets}
              </div>
              <div className="font-inter font-bold text-[#00d1b2] text-xs text-center tracking-[0] leading-[19.2px]">
                3 closing
              </div>
            </div>
          </div>

          {/* Right Logo */}
          <div className="absolute right-0 top-0 w-[189px] h-[155px] pointer-events-none flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="SpeculateX Logo"
              width={189}
              height={155}
              className="object-contain w-full h-full"
              unoptimized
            />
          </div>
        </div>

        {/* Search and Filters - Figma Design */}
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b717f99]" />
              <Input
                placeholder="Search markets..."
                className="pl-12 h-12 bg-white rounded-2xl border-[#e5e6ea80] shadow-[0px_1px_2px_#0000000d] [font-family:'Geist',Helvetica] text-sm focus:border-[#14B8A6]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="h-12 px-6 bg-[#ffffff01] rounded-2xl border-[#e5e6ea80] shadow-[0px_1px_2px_#0000000d] [font-family:'Geist',Helvetica] font-medium text-[#0f0a2e] text-sm hover:bg-white transition-colors"
            >
              <SlidersHorizontalIcon className="w-4 h-4 mr-2" />
              More Filters
            </Button>
          </div>

          <div className="mb-6">
            <p className="[font-family:'Geist',Helvetica] text-sm text-gray-500">
              <span className="font-medium">Showing </span>
              <span className="font-semibold text-[#0f0a2e]">{filteredMarkets.length}</span>
              <span className="font-medium"> markets</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 mb-8">
            {categories.map((category, index) => (
              <Badge
                key={category}
                variant={activeCategory === category ? "default" : "secondary"}
                className={`h-[42px] px-6 rounded-full cursor-pointer transition-colors ${
                  activeCategory === category
                    ? "bg-[#14B8A6] hover:bg-[#0D9488] text-white border-0"
                    : "bg-[#f0f0f280] hover:bg-[#e5e6ea80] text-[#0e092db2] border border-[#e5e6ea4c]"
                } [font-family:'Geist',Helvetica] font-medium text-sm`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </Badge>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((market, index) => (
                  <motion.div
                    key={market.id}
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      "--animation-delay": `${400 + index * 100}ms`,
                    } as React.CSSProperties}
                  >
                    <Link href={`/markets/${market.id}`}>
                      <Card className="overflow-hidden border-0 shadow-lg bg-white hover:shadow-2xl transition-all cursor-pointer h-full group">
                        <CardContent className="p-0">
                          <div className="group-hover:scale-[1.02] transition-transform duration-300 p-6">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-5">
                              <motion.div 
                                whileHover={{ rotate: 360 }}
                                transition={{ duration: 0.5 }}
                                className="w-14 h-14 bg-gradient-to-br from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-xl flex items-center justify-center text-3xl border border-[#14B8A6]/20"
                              >
                                {getMarketIcon(market.question)}
                              </motion.div>
                              <Badge
                                variant={market.status === 'LIVE TRADING' ? 'default' : market.status === 'FUNDING' ? 'secondary' : 'outline'}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-md ${
                                  market.status === 'LIVE TRADING' 
                                    ? 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white border-0' 
                                    : market.status === 'FUNDING'
                                    ? 'bg-gradient-to-r from-green-400 to-green-500 text-white border-0'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {market.status === 'LIVE TRADING' && (
                                  <motion.span
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="inline-block w-2 h-2 bg-white rounded-full mr-2"
                                  />
                                )}
                                {market.status}
                              </Badge>
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
                                <div className="text-2xl font-black text-green-700">{formatPriceInCents(market.yesPrice)}</div>
                                <div className="text-xs text-green-600 mt-1 font-semibold">Price</div>
                              </motion.div>
                              <motion.div 
                                whileHover={{ scale: 1.05 }}
                                className="bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 rounded-xl p-4 border border-red-200 text-center transition-all cursor-pointer shadow-sm hover:shadow-md"
                              >
                                <div className="text-xs font-bold text-red-600 mb-2 uppercase tracking-wide">NO</div>
                                <div className="text-2xl font-black text-red-700">{formatPriceInCents(market.noPrice)}</div>
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
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#fffefe66] border-t border-border mt-20">
        <div className="max-w-[1280px] mx-auto px-20 py-20">
          <div className="grid grid-cols-4 gap-8 mb-16">
            <div className="flex flex-col gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-base leading-6">
                Product
              </h3>
              <div className="flex flex-col gap-[18px]">
                <Link href="/markets" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Markets
                </Link>
                <Link href="/admin" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Create Market
                </Link>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  API
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-base leading-6">
                Resources
              </h3>
              <div className="flex flex-col gap-[18px]">
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Documentation
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  FAQ
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Blog
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-base leading-6">
                Community
              </h3>
              <div className="flex flex-col gap-[18px]">
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Discord
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Twitter
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Governance
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-base leading-6">
                Legal
              </h3>
              <div className="flex flex-col gap-[18px]">
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Privacy
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Terms
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5 hover:text-gray-700 transition-colors">
                  Security
                </a>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center pt-6 border-t border-[#e5e6ea80]">
            <p className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5">
              © 2025 SpeculateX. All rights reserved.
            </p>
            <p className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-sm leading-5">
              Built for the decentralized web
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
