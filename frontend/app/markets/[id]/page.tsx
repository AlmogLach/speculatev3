'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import Link from 'next/link';
import Header from '@/components/Header';
import TradingCard from '@/components/TradingCard';
import { getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { formatUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { positionTokenAbi } from '@/lib/abis';

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

  // Get user token balances
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

  // Calculate chance percentage
  const chancePercentage = priceYes * 100;
  const previousChance = 70.35; // Placeholder - would need historical data
  const chanceChange = chancePercentage - previousChance;

  // Calculate total volume
  const totalVolume = market?.totalPairsUSDC ? Number(formatUnits(market.totalPairsUSDC as bigint, 6)) : 0;

  // Get asset icon
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
      <div className="min-h-screen bg-[#FAF9FF]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#14B8A6]"></div>
            <p className="mt-4 text-gray-600">Loading market...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#FAF9FF]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-red-600">Market not found</p>
        </div>
      </div>
    );
  }

  const statusNum = Number(market.status);
  const isLive = statusNum === 0;

  return (
    <div className="min-h-screen bg-[#FAF9FF]">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link href="/markets" className="inline-flex items-center text-[#14B8A6] hover:text-[#0D9488] mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Markets
        </Link>

        {/* Market Header Card */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-orange-600">{getAssetIcon(market.question as string)}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{market.question}</h1>
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                    isLive ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    • {isLive ? 'LIVE' : 'CLOSED'}
                  </span>
                  <span className="text-sm text-gray-600">
                    Vol ${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm text-gray-500">• Jan 1, 2026</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Rules Section */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Rules</h3>
            <p className="text-sm text-gray-600">
              Bitcoin price target of $100,000 USD by end of 2026. Resolution based on Coinbase spot price at market close on December 31, 2026.
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Market Chance & Graph */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chance Display Card */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Chance</div>
                  <div className="flex items-baseline gap-3">
                    <div className="text-5xl font-bold text-green-600">{chancePercentage.toFixed(1)}%</div>
                    <div className={`text-lg font-semibold ${chanceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {chanceChange >= 0 ? '↑' : '↓'} {Math.abs(chanceChange).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    holderTab === 'yes' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                    YES
                  </button>
                  <button className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    holderTab === 'no' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                    NO
                  </button>
                </div>
              </div>

              {/* Graph Placeholder */}
              <div className="mb-4">
                <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center relative">
                  <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                    {/* Axes */}
                    <line x1="40" y1="160" x2="360" y2="160" stroke="#e5e7eb" strokeWidth="2" />
                    <line x1="40" y1="160" x2="40" y2="40" stroke="#e5e7eb" strokeWidth="2" />
                    {/* Y-axis labels */}
                    <text x="35" y="45" fill="#9ca3af" fontSize="10" textAnchor="end">0.8</text>
                    <text x="35" y="85" fill="#9ca3af" fontSize="10" textAnchor="end">0.6</text>
                    <text x="35" y="125" fill="#9ca3af" fontSize="10" textAnchor="end">0.4</text>
                    <text x="35" y="165" fill="#9ca3af" fontSize="10" textAnchor="end">0</text>
                    {/* X-axis labels */}
                    <text x="60" y="175" fill="#9ca3af" fontSize="10" textAnchor="middle">Oct 31</text>
                    <text x="140" y="175" fill="#9ca3af" fontSize="10" textAnchor="middle">Nov 2</text>
                    <text x="220" y="175" fill="#9ca3af" fontSize="10" textAnchor="middle">Nov 4</text>
                    <text x="300" y="175" fill="#9ca3af" fontSize="10" textAnchor="middle">Nov 7</text>
                    {/* Line chart */}
                    <polyline
                      points="60,140 100,130 140,110 180,90 220,70 260,60 300,50"
                      fill="none"
                      stroke="#14B8A6"
                      strokeWidth="3"
                    />
                    {/* Data points */}
                    <circle cx="60" cy="140" r="4" fill="#14B8A6" />
                    <circle cx="100" cy="130" r="4" fill="#14B8A6" />
                    <circle cx="140" cy="110" r="4" fill="#14B8A6" />
                    <circle cx="180" cy="90" r="4" fill="#14B8A6" />
                    <circle cx="220" cy="70" r="4" fill="#14B8A6" />
                    <circle cx="260" cy="60" r="4" fill="#14B8A6" />
                    <circle cx="300" cy="50" r="4" fill="#14B8A6" />
                  </svg>
                </div>
              </div>

              {/* Time Range Filters */}
              <div className="flex gap-2">
                {(['1D', '1W', '1M', 'ALL'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-[#14B8A6] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Details */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="flex gap-4 mb-6 border-b border-gray-200">
                {(['Position', 'Orders', 'Transactions', 'Resolution'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 px-4 font-semibold text-sm transition-colors ${
                      activeTab === tab
                        ? 'text-[#14B8A6] border-b-2 border-[#14B8A6]'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'Resolution' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">RESOLUTION CRITERIA</h4>
                    <p className="text-sm text-gray-600">
                      Market resolves YES if Bitcoin reaches $100,000 USD on Coinbase spot price by end of trading day December 31, 2026. Otherwise resolves NO.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Resolution Source</div>
                      <div className="text-sm font-semibold text-gray-900">Coinbase</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Resolution Date</div>
                      <div className="text-sm font-semibold text-gray-900">Dec 31, 2026</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Position' && (
                <div className="space-y-4">
                  <div className="text-center py-8 text-gray-500">
                    <p>No positions yet</p>
                  </div>
                </div>
              )}

              {activeTab === 'Orders' && (
                <div className="space-y-4">
                  <div className="text-center py-8 text-gray-500">
                    <p>No orders yet</p>
                  </div>
                </div>
              )}

              {activeTab === 'Transactions' && (
                <div className="space-y-4">
                  <div className="text-center py-8 text-gray-500">
                    <p>No transactions yet</p>
                  </div>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments</h3>
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                />
                <button className="px-6 py-3 bg-[#14B8A6] text-white rounded-lg hover:bg-[#0D9488] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-gray-900">crypto_analyst</span>
                    <span className="text-xs text-gray-500">2 hours ago</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">Bitcoin looks bullish this quarter. Expecting 50% probability higher.</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <button className="flex items-center gap-1 hover:text-[#14B8A6]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      45
                    </button>
                  </div>
                </div>
                <div className="border-b border-gray-200 pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-gray-900">market_watcher</span>
                    <span className="text-xs text-gray-500">4 hours ago</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">Strong resistance at 95k. This might take longer than expected.</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <button className="flex items-center gap-1 hover:text-[#14B8A6]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      32
                    </button>
                  </div>
                </div>
                <div className="pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-gray-900">defi_trader</span>
                    <span className="text-xs text-gray-500">6 hours ago</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">If Fed continues easing, we'll definitely see 100k.</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <button className="flex items-center gap-1 hover:text-[#14B8A6]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      28
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Trading Interface & Top Holders */}
          <div className="space-y-6">
            {/* Trading Card */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              {isConnected ? (
                <TradingCard marketId={parseInt(marketId)} question={market.question as string} />
              ) : (
                <div className="space-y-6">
                  {/* Buy/Sell Tabs */}
                  <div className="flex gap-2 border-b border-gray-200">
                    <button className="px-6 py-3 font-semibold text-sm text-[#14B8A6] border-b-2 border-[#14B8A6]">
                      BUY
                    </button>
                    <button className="px-6 py-3 font-semibold text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                      SELL
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    </button>
                  </div>

                  {/* Price Boxes */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="text-xs text-gray-600 mb-1">YES</div>
                      <div className="text-2xl font-bold text-green-700">${priceYes.toFixed(3)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="text-xs text-gray-600 mb-1">NO</div>
                      <div className="text-2xl font-bold text-red-700">${priceNo.toFixed(3)}</div>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Amount</label>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">-</button>
                      <input
                        type="number"
                        placeholder="0.0"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                      />
                      <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">+</button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-sm text-gray-600">
                    Balance 0 Shares
                  </div>

                  {/* Quick Share Buttons */}
                  <div className="flex gap-2">
                    {[10, 50, 100, 'Max'].map((val) => (
                      <button
                        key={val}
                        className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
                      >
                        {val}
                      </button>
                    ))}
                  </div>

                  {/* Set Expiration Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Set Expiration</span>
                    <button className="w-12 h-6 bg-gray-200 rounded-full relative">
                      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 transition-transform"></div>
                    </button>
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Total</span>
                    <span className="text-lg font-bold text-gray-900">$0.00</span>
                  </div>

                  {/* Connect Wallet Button */}
                  <button className="w-full py-4 bg-[#14B8A6] text-white rounded-lg font-semibold hover:bg-[#0D9488] transition-colors">
                    Connect Wallet
                  </button>

                  <p className="text-xs text-center text-gray-500">
                    By trading, you agree to the Privacy and Terms.
                  </p>
                </div>
              )}
            </div>

            {/* Top Holders */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Holders</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setHolderTab('yes')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    holderTab === 'yes'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  YES
                </button>
                <button
                  onClick={() => setHolderTab('no')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    holderTab === 'no'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  NO
                </button>
              </div>
              <div className="space-y-3">
                {/* Placeholder holders - would need to query from contract events */}
                {holderTab === 'yes' ? (
                  <>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-900">jax</span>
                      <span className="text-sm text-gray-600">$2.00</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-900">zin888</span>
                      <span className="text-sm text-gray-600">$1.20</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-900">10xlong.btc</span>
                      <span className="text-sm text-gray-600">$1.11</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-900">bear_market</span>
                      <span className="text-sm text-gray-600">$1.50</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-gray-900">skeptic_crypto</span>
                      <span className="text-sm text-gray-600">$0.90</span>
                    </div>
                  </>
                )}
                <div className="text-center py-4 text-sm text-gray-500">
                  {address && holderTab === 'yes' && parseFloat(yesBalance) > 0 && (
                    <div className="flex justify-between items-center py-2 border-t border-gray-200 mt-2 pt-2">
                      <span className="text-sm font-medium text-gray-900">You</span>
                      <span className="text-sm text-gray-600">${(parseFloat(yesBalance) * priceYes).toFixed(2)}</span>
                    </div>
                  )}
                  {address && holderTab === 'no' && parseFloat(noBalance) > 0 && (
                    <div className="flex justify-between items-center py-2 border-t border-gray-200 mt-2 pt-2">
                      <span className="text-sm font-medium text-gray-900">You</span>
                      <span className="text-sm text-gray-600">${(parseFloat(noBalance) * priceNo).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
