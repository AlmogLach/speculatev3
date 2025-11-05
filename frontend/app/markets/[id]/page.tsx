'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import TradingCard from '@/components/TradingCard';
import { getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { formatUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { positionTokenAbi } from '@/lib/abis';
import { useTopHolders } from '@/lib/useTopHolders';
import { useTransactions } from '@/lib/useTransactions';
import { usePriceHistory, PricePoint } from '@/lib/usePriceHistory';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';

// Enhanced Price Chart Component
function PriceChart({ data }: { data: PricePoint[] }) {
  const [chartKey, setChartKey] = useState(0);
  
  // Debug logging and force re-render when data changes
  useEffect(() => {
    console.log('[PriceChart] Data received:', {
      length: data.length,
      sample: data.slice(0, 3),
      allPrices: data.map(d => d.price),
    });
    // Force chart to re-render when data changes
    setChartKey(prev => prev + 1);
  }, [data]);

  if (data.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-full"
      >
        <div className="text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-16 h-16 bg-gradient-to-br from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg className="w-8 h-8 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </motion.div>
          <div className="text-sm font-semibold text-gray-600 mb-1">No price data available</div>
          <div className="text-xs text-gray-400">Price history will appear after trades</div>
        </div>
      </motion.div>
    );
  }

  const chartData = data.map(point => {
    const date = new Date(point.timestamp * 1000);
    return {
      time: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }),
      price: point.price * 100, // Convert to percentage
      priceDecimal: point.price,
      timestamp: point.timestamp,
      fullDate: date.toISOString(),
    };
  });

  console.log('[PriceChart] Chart data prepared:', {
    length: chartData.length,
    sample: chartData.slice(0, 3),
    priceRange: [Math.min(...chartData.map(d => d.price)), Math.max(...chartData.map(d => d.price))],
  });

  const prices = data.map(d => d.price * 100);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  let domain: [number, number];
  if (priceRange === 0) {
    const center = minPrice;
    domain = [Math.max(0, center - 5), Math.min(100, center + 5)];
  } else {
    const padding = priceRange * 0.15;
    domain = [
      Math.max(0, minPrice - padding),
      Math.min(100, maxPrice + padding)
    ];
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositive = data.price >= 50;
      return (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-4 rounded-xl shadow-2xl border border-gray-200"
        >
          <p className={`text-lg font-black mb-2 ${isPositive ? 'text-[#14B8A6]' : 'text-red-500'}`}>
            {data.price.toFixed(2)}%
          </p>
          <p className="text-xs font-semibold text-gray-700 mb-1">
            ${data.priceDecimal.toFixed(4)} per share
          </p>
          <p className="text-xs text-gray-500">
            {new Date(data.timestamp * 1000).toLocaleString()}
          </p>
        </motion.div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => `${value.toFixed(0)}%`;

  // Sort data by timestamp to ensure chronological order
  const sortedChartData = [...chartData].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="w-full h-full" style={{ minHeight: '280px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          key={chartKey}
          data={sortedChartData}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
        >
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.4} />
            <stop offset="50%" stopColor="#14B8A6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="50%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#e5e7eb" 
          vertical={false}
          strokeWidth={1}
          opacity={0.5}
        />
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }}
          interval="preserveStartEnd"
          minTickGap={50}
        />
        <YAxis
          domain={domain}
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }}
          tickFormatter={formatYAxis}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#14B8A6', strokeWidth: 2, strokeDasharray: '5 5' }} />
        <Area
          type="monotone"
          dataKey="price"
          stroke="none"
          fill="url(#priceGradient)"
          fillOpacity={1}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="url(#lineGradient)"
          strokeWidth={3}
          dot={false}
          activeDot={{ 
            r: 8, 
            fill: '#14B8A6', 
            stroke: '#fff', 
            strokeWidth: 3,
            filter: 'drop-shadow(0 0 8px rgba(20, 184, 166, 0.5))'
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;
  const { address, isConnected } = useAccount();
  const [market, setMarket] = useState<any>(null);
  const [priceYes, setPriceYes] = useState<number>(0);
  const [priceNo, setPriceNo] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Position' | 'Orders' | 'Transactions' | 'Resolution'>('Resolution');
  const [holderTab, setHolderTab] = useState<'yes' | 'no'>('yes');
  const [timeRange, setTimeRange] = useState<'1D' | '1W' | '1M' | 'ALL'>('1W');
  const [yesBalance, setYesBalance] = useState<string>('0');
  const [noBalance, setNoBalance] = useState<string>('0');
  
  const { data: topHoldersYes = [] } = useTopHolders(
    marketId ? parseInt(marketId) : null,
    priceYes,
    'yes'
  );
  const { data: topHoldersNo = [] } = useTopHolders(
    marketId ? parseInt(marketId) : null,
    priceNo,
    'no'
  );
  
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions(
    marketId ? parseInt(marketId) : null
  );

  const { data: priceHistory = [], isLoading: historyLoading } = usePriceHistory(
    marketId ? parseInt(marketId) : null,
    timeRange
  );

  const loadMarket = useCallback(async () => {
    if (!marketId) return;
    try {
      const data = await getMarket(BigInt(marketId));
      const yesPrice = await getPriceYes(BigInt(marketId));
      const noPrice = await getPriceNo(BigInt(marketId));
      
      setMarket(data);
      setPriceYes(parseFloat(yesPrice));
      setPriceNo(parseFloat(noPrice));
    } catch (error) {
      console.error('Error loading market:', error);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    if (marketId) {
      loadMarket();
    }
  }, [marketId, loadMarket]);

  const { data: yesBal } = useReadContract({
    address: market?.yes as `0x${string}` | undefined,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && market?.yes),
    },
  });

  const { data: noBal } = useReadContract({
    address: market?.no as `0x${string}` | undefined,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && market?.no),
    },
  });

  useEffect(() => {
    if (yesBal) {
      setYesBalance(formatUnits(yesBal as bigint, 18));
    }
    if (noBal) {
      setNoBalance(formatUnits(noBal as bigint, 18));
    }
  }, [yesBal, noBal]);

  const chancePercentage = priceYes * 100;
  
  // Calculate actual change from price history
  // Compare current price with the earliest price in the selected time range
  let chanceChange = 0;
  if (priceHistory.length > 0) {
    // Sort by timestamp (oldest first) to get the first price in the time range
    const sortedHistory = [...priceHistory].sort((a, b) => a.timestamp - b.timestamp);
    const firstPrice = sortedHistory[0].price * 100;
    chanceChange = chancePercentage - firstPrice;
  } else {
    // No price history yet, show 0 change
    chanceChange = 0;
  }

  const totalVolume = market?.totalPairsUSDC ? Number(formatUnits(market.totalPairsUSDC as bigint, 6)) : 0;

  const getAssetIcon = (question: string) => {
    if (question.includes('BTC') || question.includes('Bitcoin')) return '₿';
    if (question.includes('ETH') || question.includes('Ethereum')) return 'Ξ';
    if (question.includes('Sol') || question.includes('Solana')) return '◎';
    if (question.includes('XRP') || question.includes('Ripple')) return '✕';
    if (question.includes('Doge') || question.includes('Dogecoin')) return '🐕';
    if (question.includes('BNB')) return '🔷';
    return '💵';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9FF] relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#14B8A6]/20 to-purple-400/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity }}
          />
        </div>
        <Header />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 border-4 border-[#14B8A6] border-t-transparent rounded-full mx-auto"
          />
          <p className="mt-6 text-lg font-semibold text-gray-600 text-center">Loading market...</p>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#FAF9FF]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center bg-white rounded-2xl p-12 shadow-xl"
          >
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Market Not Found</h2>
            <p className="text-gray-600 mb-6">The market you&apos;re looking for doesn&apos;t exist.</p>
            <Link
              href="/markets"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white font-bold rounded-lg hover:shadow-lg transition-all"
            >
              Back to Markets
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const statusNum = Number(market.status);
  const isLive = statusNum === 0;

  return (
    <div className="min-h-screen bg-[#FAF9FF] relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#14B8A6]/20 to-purple-400/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-[#14B8A6]/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, delay: 2 }}
        />
      </div>

      <Header />
      
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <Link href="/markets" className="inline-flex items-center text-[#14B8A6] hover:text-[#0D9488] mb-6 font-semibold group">
            <motion.svg 
              className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </motion.svg>
            BACK TO MARKETS
          </Link>
        </motion.div>

        {/* Market Header Card */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100 mb-8"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-6 flex-1">
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-16 h-16 bg-gradient-to-br from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-2xl flex items-center justify-center border border-[#14B8A6]/20"
              >
                <span className="text-3xl">{getAssetIcon(market.question as string)}</span>
              </motion.div>
              <div className="flex-1">
                <h1 className="text-3xl font-black text-gray-900 mb-3">{market.question}</h1>
                <div className="flex flex-wrap items-center gap-4">
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-md ${
                      isLive ? 'bg-gradient-to-r from-red-400 to-red-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {isLive && (
                      <motion.span
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 bg-white rounded-full mr-2"
                      />
                    )}
                    {isLive ? 'LIVE' : 'CLOSED'}
                  </motion.span>
                  <span className="text-sm font-semibold text-gray-600">
                    Vol ${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm text-gray-500">• Ends Jan 1, 2026</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </motion.button>
            </div>
          </div>

          {/* Rules Section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 pt-6 border-t border-gray-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[#14B8A6]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Resolution Rules</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Bitcoin price target of $100,000 USD by end of 2026. Resolution based on Coinbase spot price at market close on December 31, 2026.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Market Chance & Graph */}
          <div className="lg:col-span-2 space-y-8">
            {/* Chance Display & Chart Card */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wider">Market Probability</div>
                  <div className="flex items-baseline gap-4">
                    <motion.div 
                      key={chancePercentage}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-6xl font-black bg-gradient-to-r from-[#14B8A6] to-[#0D9488] bg-clip-text text-transparent"
                    >
                      {chancePercentage.toFixed(1)}%
                    </motion.div>
                    <motion.div 
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className={`flex items-center text-xl font-bold ${chanceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {chanceChange >= 0 ? '↑' : '↓'} {Math.abs(chanceChange).toFixed(2)}%
                    </motion.div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setHolderTab('yes')}
                    className={`px-8 py-4 rounded-xl font-bold transition-all shadow-lg ${
                      holderTab === 'yes' 
                        ? 'bg-gradient-to-r from-green-400 to-green-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    YES
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setHolderTab('no')}
                    className={`px-8 py-4 rounded-xl font-bold transition-all shadow-lg ${
                      holderTab === 'no' 
                        ? 'bg-gradient-to-r from-red-400 to-red-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    NO
                  </motion.button>
                </div>
              </div>

              {/* Enhanced Price History Graph */}
              <div className="mb-6">
                <div className="h-80 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 border-gray-100 p-6 relative overflow-hidden shadow-inner flex items-center justify-center">
                  {historyLoading ? (
                    <div className="flex items-center justify-center h-full w-full">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 border-4 border-[#14B8A6] border-t-transparent rounded-full"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full">
                      <PriceChart key={`${marketId}-${timeRange}-${priceHistory.length}`} data={priceHistory} />
                    </div>
                  )}
                </div>
              </div>

              {/* Time Range Filters */}
              <div className="flex gap-3">
                {(['1D', '1W', '1M', 'ALL'] as const).map((range, index) => (
                  <motion.button
                    key={range}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTimeRange(range)}
                    className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md ${
                      timeRange === range
                        ? 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
                    }`}
                  >
                    {range}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Tabs Section */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100"
            >
              <div className="flex gap-2 mb-8 bg-gray-50 rounded-xl p-2">
                {(['Position', 'Orders', 'Transactions', 'Resolution'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative flex-1 px-6 py-3 font-bold text-sm transition-all rounded-lg ${
                      activeTab === tab
                        ? 'text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] rounded-lg shadow-lg"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10">{tab}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {activeTab === 'Resolution' && (
                    <div className="space-y-6">
                      <div className="p-6 bg-gradient-to-br from-[#14B8A6]/5 to-[#14B8A6]/10 rounded-xl border border-[#14B8A6]/20">
                        <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Resolution Criteria
                        </h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          Market resolves YES if Bitcoin reaches $100,000 USD on Coinbase spot price by end of trading day December 31, 2026. Otherwise resolves NO.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <div className="text-xs font-bold text-gray-500 mb-2 uppercase">Resolution Source</div>
                          <div className="text-sm font-bold text-gray-900">Coinbase</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <div className="text-xs font-bold text-gray-500 mb-2 uppercase">Resolution Date</div>
                          <div className="text-sm font-bold text-gray-900">Dec 31, 2026</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Position' && (
                    <div className="space-y-6">
                      {!isConnected ? (
                        <div className="text-center py-16">
                          <div className="w-16 h-16 bg-gradient-to-br from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <p className="text-gray-500 font-semibold">Connect wallet to view your positions</p>
                        </div>
                      ) : parseFloat(yesBalance) === 0 && parseFloat(noBalance) === 0 ? (
                        <div className="text-center py-16">
                          <div className="text-6xl mb-4">📊</div>
                          <p className="text-gray-500 font-semibold">No positions yet</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {parseFloat(yesBalance) > 0 && (
                            <motion.div 
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 shadow-lg"
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="text-sm font-bold text-green-600 mb-2 uppercase tracking-wide">YES Position</div>
                                  <div className="text-3xl font-black text-green-800">{parseFloat(yesBalance).toFixed(4)} shares</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600 mb-1 font-semibold">Value</div>
                                  <div className="text-2xl font-black text-gray-900">
                                    ${(parseFloat(yesBalance) * priceYes).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-green-200 text-xs text-gray-600">
                                <div className="flex justify-between">
                                  <span className="font-semibold">Price per share:</span>
                                  <span className="font-bold">${priceYes.toFixed(4)}</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                          {parseFloat(noBalance) > 0 && (
                            <motion.div 
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: 0.1 }}
                              className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border-2 border-red-200 shadow-lg"
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="text-sm font-bold text-red-600 mb-2 uppercase tracking-wide">NO Position</div>
                                  <div className="text-3xl font-black text-red-800">{parseFloat(noBalance).toFixed(4)} shares</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600 mb-1 font-semibold">Value</div>
                                  <div className="text-2xl font-black text-gray-900">
                                    ${(parseFloat(noBalance) * priceNo).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-4 pt-4 border-t border-red-200 text-xs text-gray-600">
                                <div className="flex justify-between">
                                  <span className="font-semibold">Price per share:</span>
                                  <span className="font-bold">${priceNo.toFixed(4)}</span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Orders' && (
                    <div className="text-center py-16">
                      <div className="text-6xl mb-4">📋</div>
                      <p className="text-gray-500 font-semibold">No orders yet</p>
                    </div>
                  )}

                  {activeTab === 'Transactions' && (
                    <div className="space-y-3">
                      {transactionsLoading ? (
                        <div className="text-center py-16">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="inline-block w-12 h-12 border-4 border-[#14B8A6] border-t-transparent rounded-full"
                          />
                          <p className="mt-4 text-gray-500 font-semibold">Loading transactions...</p>
                        </div>
                      ) : transactions.length === 0 ? (
                        <div className="text-center py-16">
                          <div className="text-6xl mb-4">📜</div>
                          <p className="text-gray-500 font-semibold">No transactions yet</p>
                        </div>
                      ) : (
                        transactions.map((tx, index) => (
                          <motion.div
                            key={tx.id}
                            initial={{ x: -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border border-gray-200 hover:border-[#14B8A6]"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase shadow-md ${
                                tx.type === 'BuyYes' || tx.type === 'BuyNo'
                                  ? 'bg-gradient-to-r from-green-400 to-green-500 text-white'
                                  : 'bg-gradient-to-r from-red-400 to-red-500 text-white'
                              }`}>
                                {tx.type}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-900">
                                  {tx.user.slice(0, 6)}...{tx.user.slice(-4)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(tx.timestamp * 1000).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right mr-4">
                              <div className="text-sm font-bold text-gray-900">
                                {tx.amount} → {tx.output}
                              </div>
                              <div className="text-xs text-gray-500">
                                Price: ${tx.price}
                              </div>
                            </div>
                            <a
                              href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#14B8A6] hover:text-[#0D9488] font-bold text-sm flex items-center gap-1"
                            >
                              View
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </motion.div>
                        ))
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Right Column - Trading Interface & Top Holders */}
          <div className="space-y-8">
            {/* Trading Card */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 sticky top-8"
            >
              <TradingCard marketId={parseInt(marketId)} question={market.question as string} />
            </motion.div>

            {/* Top Holders */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100"
            >
              <h3 className="text-xl font-black text-gray-900 mb-6">Top Holders</h3>
              <div className="flex gap-2 mb-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setHolderTab('yes')}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-md ${
                    holderTab === 'yes'
                      ? 'bg-gradient-to-r from-green-400 to-green-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  YES
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setHolderTab('no')}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-md ${
                    holderTab === 'no'
                      ? 'bg-gradient-to-r from-red-400 to-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  NO
                </motion.button>
              </div>
              <div className="space-y-3">
                {holderTab === 'yes' ? (
                  topHoldersYes.length > 0 ? (
                    topHoldersYes.map((holder, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-sm font-bold text-gray-900 truncate mr-2">
                          {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                        </span>
                        <span className="text-sm font-bold text-[#14B8A6]">${holder.balanceUsd.toFixed(2)}</span>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-sm text-gray-500 font-semibold">No holders yet</div>
                  )
                ) : (
                  topHoldersNo.length > 0 ? (
                    topHoldersNo.map((holder, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="text-sm font-bold text-gray-900 truncate mr-2">
                          {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                        </span>
                        <span className="text-sm font-bold text-[#14B8A6]">${holder.balanceUsd.toFixed(2)}</span>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-sm text-gray-500 font-semibold">No holders yet</div>
                  )
                )}
                {address && holderTab === 'yes' && parseFloat(yesBalance) > 0 && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-lg border-2 border-[#14B8A6]/20 mt-4"
                  >
                    <span className="text-sm font-bold text-gray-900">You</span>
                    <span className="text-sm font-bold text-[#14B8A6]">${(parseFloat(yesBalance) * priceYes).toFixed(2)}</span>
                  </motion.div>
                )}
                {address && holderTab === 'no' && parseFloat(noBalance) > 0 && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-[#14B8A6]/10 to-[#14B8A6]/5 rounded-lg border-2 border-[#14B8A6]/20 mt-4"
                  >
                    <span className="text-sm font-bold text-gray-900">You</span>
                    <span className="text-sm font-bold text-[#14B8A6]">${(parseFloat(noBalance) * priceNo).toFixed(2)}</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}