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
import { useQuery } from '@tanstack/react-query';
import { fetchUniqueTradersCount } from '@/lib/subgraph';

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
  
  // Fetch unique traders count from subgraph
  const { data: activeTraders = 0 } = useQuery({
    queryKey: ['uniqueTraders'],
    queryFn: async () => {
      try {
        return await fetchUniqueTradersCount();
      } catch (error) {
        console.error('Error fetching unique traders:', error);
        return 0;
      }
    },
    refetchInterval: 60000, // Refetch every minute
  });

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

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 md:py-16">
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
          <h1 className="[font-family:'Geist',Helvetica] font-bold text-[#0f0a2e] text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-[0] leading-tight sm:leading-[50px] md:leading-[60px] mb-6 translate-y-[-1rem] animate-fade-in opacity-0 [--animation-delay:200ms]">
            What&apos;s the Market Thinking?
          </h1>
          <p className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-base sm:text-lg tracking-[0] leading-6 sm:leading-7 mb-8 max-w-[668px] translate-y-[-1rem] animate-fade-in opacity-0 [--animation-delay:400ms]">
            Trade what you believe in every market reflects real-time sentiment and liquidity.
          </p>
        </div>

        {/* Stats Banner - Figma Design with Logo Patterns */}
        <div className="relative bg-white rounded-2xl border-2 border-[#14B8A6] border-solid shadow-lg mb-8 sm:mb-12 translate-y-[-1rem] animate-fade-in opacity-0 [--animation-delay:600ms] overflow-hidden" style={{ boxSizing: 'border-box' }}>
          {/* Left Logo - Subtle background on mobile */}
          <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-16 md:w-[182px] pointer-events-none flex items-center justify-center overflow-hidden opacity-15 sm:opacity-30 md:opacity-100">
            <Image
              src="/leftside.png"
              alt="SpeculateX Logo"
              width={182}
              height={155}
              className="object-contain w-full h-full"
              unoptimized
            />
          </div>

          {/* Stats Content */}
          <div className="relative z-10 grid grid-cols-3 md:flex md:items-center md:justify-center gap-2 sm:gap-3 md:gap-12 lg:gap-20 xl:gap-32 px-3 sm:px-4 md:px-8 py-5 sm:py-6 md:py-0 min-h-[140px] md:min-h-[155px]">
            {/* Total Volume */}
            <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 md:gap-4">
              <div className="font-inter text-gray-500 text-[9px] sm:text-[10px] md:text-[11px] text-center tracking-[0.55px] leading-[17.6px] uppercase">
                TOTAL VOLUME
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="font-inter text-[#0a0e17] text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-[32px] text-center tracking-[0] leading-tight font-bold">
                  {totalVolume.toFixed(0)}
                </div>
                <div className="font-inter text-[#0a0e17] text-sm sm:text-base md:text-lg lg:text-xl text-center tracking-[0] leading-tight font-bold">
                  USDT
                </div>
              </div>
              <div className="font-inter font-bold text-[#00d1b2] text-[9px] sm:text-[10px] md:text-xs text-center tracking-[0] leading-[19.2px]">
                +12%
              </div>
            </div>

            {/* Active Traders */}
            <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 md:gap-4">
              <div className="font-inter text-gray-500 text-[9px] sm:text-[10px] md:text-[11px] text-center tracking-[0.55px] leading-[17.6px] uppercase">
                ACTIVE TRADERS
              </div>
              <div className="font-inter text-[#0a0e17] text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-[32px] text-center tracking-[0] leading-tight font-bold">
                {activeTraders}
              </div>
              <div className="font-inter font-bold text-[#00d1b2] text-[9px] sm:text-[10px] md:text-xs text-center tracking-[0] leading-[19.2px]">
                +18 today
              </div>
            </div>

            {/* Live Markets */}
            <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2 md:gap-4">
              <div className="font-inter text-gray-500 text-[9px] sm:text-[10px] md:text-[11px] text-center tracking-[0.55px] leading-[17.6px] uppercase">
                LIVE MARKETS
              </div>
              <div className="font-inter text-[#0a0e17] text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-[32px] text-center tracking-[0] leading-tight font-bold">
                {liveMarkets}
              </div>
              <div className="font-inter font-bold text-[#00d1b2] text-[9px] sm:text-[10px] md:text-xs text-center tracking-[0] leading-[19.2px]">
                3 closing
              </div>
            </div>
          </div>

          {/* Right Logo - Subtle background on mobile */}
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-16 md:w-[189px] pointer-events-none flex items-center justify-center overflow-hidden opacity-15 sm:opacity-30 md:opacity-100">
            <Image
              src="/rightside.png"
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
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
                      <Card className="overflow-hidden border-0 shadow-lg bg-white hover:shadow-2xl transition-all cursor-pointer h-full group rounded-2xl">
                        <CardContent className="p-4 sm:p-5 md:p-6">
                          {/* Header - Icon and Question */}
                          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-orange-500 rounded-full flex items-center justify-center text-white text-xl sm:text-2xl md:text-3xl font-bold flex-shrink-0">
                              {getMarketIcon(market.question)}
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 flex-1 line-clamp-2">
                              {market.question}
                            </h3>
                          </div>

                          {/* Yes/No Buttons */}
                          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
                            <button className="bg-green-50 hover:bg-green-100 rounded-lg py-3 sm:py-4 px-3 sm:px-4 text-center transition-colors">
                              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                                <div className="text-sm sm:text-base font-bold text-green-700">Yes</div>
                                <div className="text-[10px] sm:text-xs font-bold text-gray-600">{formatPriceInCents(market.yesPrice)}</div>
                              </div>
                            </button>
                            <button className="bg-red-50 hover:bg-red-100 rounded-lg py-3 sm:py-4 px-3 sm:px-4 text-center transition-colors">
                              <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                                <div className="text-sm sm:text-base font-bold text-red-700">No</div>
                                <div className="text-[10px] sm:text-xs font-bold text-gray-600">{formatPriceInCents(market.noPrice)}</div>
                              </div>
                            </button>
                          </div>

                          {/* Progress Bar - Red on left, Green on right */}
                          <div className="mb-4 sm:mb-6">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                              <div className="flex h-full">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${market.noPercent}%` }}
                                  transition={{ duration: 1, delay: index * 0.05 }}
                                  className="bg-red-500 h-full"
                                />
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${market.yesPercent}%` }}
                                  transition={{ duration: 1, delay: index * 0.05 }}
                                  className="bg-green-500 h-full"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Footer - Volume and Duration */}
                          <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">Volume</span>
                              <span className="text-sm sm:text-base font-bold text-gray-900">
                                ${market.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">Durations</span>
                              <span className="text-sm sm:text-base font-bold text-gray-900">
                                {Math.floor(Math.random() * 7 + 1)}D {Math.floor(Math.random() * 60)}M
                              </span>
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
      <footer className="w-full bg-[#fffefe66] border-t border-border mt-12 sm:mt-20">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-12 lg:px-20 py-8 sm:py-12 md:py-16 lg:py-20">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12 md:mb-16">
            <div className="flex flex-col gap-4 sm:gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-sm sm:text-base leading-6">
                Product
              </h3>
              <div className="flex flex-col gap-3 sm:gap-[18px]">
                <Link href="/markets" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Markets
                </Link>
                <Link href="/admin" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Create Market
                </Link>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  API
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-sm sm:text-base leading-6">
                Resources
              </h3>
              <div className="flex flex-col gap-3 sm:gap-[18px]">
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Documentation
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  FAQ
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Blog
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-sm sm:text-base leading-6">
                Community
              </h3>
              <div className="flex flex-col gap-3 sm:gap-[18px]">
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Discord
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Twitter
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Governance
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:gap-6">
              <h3 className="[font-family:'Geist',Helvetica] font-semibold text-[#0f0a2e] text-sm sm:text-base leading-6">
                Legal
              </h3>
              <div className="flex flex-col gap-3 sm:gap-[18px]">
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Privacy
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Terms
                </a>
                <a href="#" className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 hover:text-gray-700 transition-colors">
                  Security
                </a>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 pt-4 sm:pt-6 border-t border-[#e5e6ea80]">
            <p className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 text-center sm:text-left">
              © 2025 SpeculateX. All rights reserved.
            </p>
            <p className="[font-family:'Geist',Helvetica] font-light text-gray-500 text-xs sm:text-sm leading-5 text-center sm:text-right">
              Built for the decentralized web
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
