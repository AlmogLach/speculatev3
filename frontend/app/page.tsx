'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { getMarketCount, getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { formatUnits } from 'viem';

interface MarketCard {
  id: number;
  asset: string;
  question: string;
  yesPrice: string;
  noPrice: string;
  volume: string;
  yesPercent: number;
  noPercent: number;
  status: 'LIVE TRADING' | 'FUNDING' | 'RESOLVED';
  liquidity: string;
}

export default function Home() {
  const [marketCount, setMarketCount] = useState<number | null>(null);
  const [markets, setMarkets] = useState<MarketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [liveMarkets, setLiveMarkets] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const count = await getMarketCount();
      setMarketCount(Number(count));
      
      // Load ALL markets from the contract (no mockups)
      const marketArray: MarketCard[] = [];
      
      for (let i = 1; i <= Number(count); i++) {
        try {
          const market = await getMarket(BigInt(i));
          if (!market.exists) continue;
          
          const priceYes = parseFloat(await getPriceYes(BigInt(i)));
          const priceNo = parseFloat(await getPriceNo(BigInt(i)));
          
          const totalPairs = Number(formatUnits(market.totalPairsUSDC as bigint, 6));
          const statusNum = Number(market.status);
          const status = statusNum === 0 ? 'LIVE TRADING' : statusNum === 1 ? 'FUNDING' : 'RESOLVED';
          
          // Extract asset name from question (simple heuristic)
          const assetName = market.question?.split(' ')[0]?.toUpperCase() || 'MARKET';
          
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
            asset: assetName,
            question: market.question as string,
            yesPrice: priceYes.toFixed(3),
            noPrice: priceNo.toFixed(3),
            volume: totalPairs > 0 ? `$${totalPairs.toLocaleString()}` : '$0',
            yesPercent,
            noPercent,
            status,
            liquidity: totalPairs > 0 ? `${(totalPairs / 1000).toFixed(1)}K` : '0',
          });
        } catch (error) {
          console.error(`Error loading market ${i}:`, error);
        }
      }
      
      // Calculate real statistics from marketArray
      const totalVol = marketArray.reduce((sum, m) => {
        const volStr = m.volume.replace('$', '').replace(/,/g, '');
        return sum + (parseFloat(volStr) || 0);
      }, 0);
      
      const liveCount = marketArray.filter(m => m.status === 'LIVE TRADING').length;
      
      setTotalVolume(totalVol);
      setLiveMarkets(liveCount);
      
      // Only show markets that exist (no placeholders)
      setMarkets(marketArray);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FF]">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#FAF9FF] pt-20 pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Content */}
            <div>
              <div className="inline-flex items-center rounded-full bg-[#14B8A6] px-4 py-1.5 text-xs font-semibold text-white mb-6">
                BETA LIVE
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6">
                Profit from the{' '}
                <span className="block">Curve Wars</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-xl">
                Trade on crypto market predictions with instant liquidity and zero slippage. Bet YES or NO on real-world outcomes with verifiable oracle data.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Link
                  href="/markets"
                  className="inline-flex items-center justify-center rounded-lg bg-[#14B8A6] px-8 py-4 text-base font-semibold text-white hover:bg-[#0D9488] transition-colors shadow-lg"
                >
                  Launch App
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="#features"
                  className="inline-flex items-center justify-center rounded-lg border-2 border-gray-300 px-8 py-4 text-base font-semibold text-gray-700 hover:border-gray-400 transition-colors bg-white"
                >
                  Learn More
                </Link>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>0.5% trading fee</span>
                <span>•</span>
                <span>Instant settlement</span>
                <span>•</span>
                <span>Oracle verified</span>
              </div>
            </div>

            {/* Right Side - Stats Cards */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div className="w-64 h-96 bg-[#14B8A6] rounded-3xl transform rotate-12"></div>
              </div>
              <div className="relative grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">ACTIVE MARKETS</div>
                  <div className="text-3xl font-bold text-[#14B8A6] mb-1">
                    {marketCount !== null ? marketCount : '24'}
                  </div>
                  <div className="text-xs text-gray-500">Live trading</div>
                  <div className="absolute top-4 right-4 text-gray-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">TOTAL VOLUME</div>
                  <div className="text-3xl font-bold text-[#14B8A6] mb-1">
                    {totalVolume >= 1000000 
                      ? `$${(totalVolume / 1000000).toFixed(2)}M`
                      : totalVolume >= 1000
                      ? `$${(totalVolume / 1000).toFixed(2)}K`
                      : `$${totalVolume.toFixed(2)}`}
                  </div>
                  <div className="text-xs text-gray-500">All time</div>
                  <div className="absolute top-4 right-4 text-gray-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">LIVE MARKETS</div>
                  <div className="text-3xl font-bold text-[#14B8A6] mb-1">{liveMarkets}</div>
                  <div className="text-xs text-gray-500">Active now</div>
                  <div className="absolute top-4 right-4 text-gray-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">24H VOLUME</div>
                  <div className="text-3xl font-bold text-[#14B8A6] mb-1">
                    {totalVolume >= 1000000 
                      ? `$${(totalVolume / 1000000).toFixed(2)}M`
                      : totalVolume >= 1000
                      ? `$${(totalVolume / 1000).toFixed(2)}K`
                      : `$${totalVolume.toFixed(2)}`}
                  </div>
                  <div className="text-xs text-gray-500">Current period</div>
                  <div className="absolute top-4 right-4 text-gray-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Markets Section */}
      <section id="markets" className="py-20 bg-[#FAF9FF]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-sm text-gray-500 uppercase tracking-wide mb-2">MARKETS</div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Discover Active Predictions
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Trade on crypto market predictions with instant liquidity. Real-time data from oracle feeds ensures accurate market resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <div key={market.id} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-sm font-bold text-gray-900">{market.asset}</div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    market.status === 'LIVE TRADING' 
                      ? 'bg-[#14B8A6] text-white' 
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {market.status}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">{market.question}</h3>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">YES</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-1">${market.yesPrice}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">NO</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="text-lg font-bold text-gray-900 mt-1">${market.noPrice}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>Volume</span>
                    <span>{market.volume}</span>
                  </div>
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
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                    <span>YES {market.yesPercent}%</span>
                    <span>NO {market.noPercent}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{market.liquidity} USDC CAP</span>
                </div>

                <Link
                  href={`/markets/${market.id}`}
                  className="w-full rounded-lg bg-[#14B8A6] px-4 py-3 text-sm font-semibold text-white text-center hover:bg-[#0D9488] transition-colors block"
                >
                  Trade Market
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-[#FAF9FF]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="text-sm text-gray-500 uppercase tracking-wide mb-2">FEATURES</div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why Trade on SpeculateX
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Built for the decentralized web with security, speed and transparency at its core.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Instant Liquidity',
                description: 'Trade instantly with continuous liquidity pools. No waiting for matching orders or market makers.',
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                title: 'Secure Smart Contracts',
                description: 'Audited and battle-tested contracts ensure your funds are safe. Built on proven DeFi protocols.',
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Real-Time Data',
                description: 'Oracle-powered markets with real-time price feeds. Accurate resolution based on verified on-chain data.',
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ),
                title: '0.5% Trading Fee',
                description: 'Low fees ensure more value for traders. Competitive rates with transparent fee structure.',
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: 'Community-Driven',
                description: 'Anyone can create markets. Community proposals and governance shape the platform\'s future.',
              },
              {
                icon: (
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                ),
                title: 'Best Odds',
                description: 'Fair pricing through AMM mechanics. No manipulation, just pure market dynamics.',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="text-[#14B8A6] mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#14B8A6] to-[#0D9488] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to Start Trading?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Connect your wallet and start predicting market outcomes. Secure, transparent, and instant settlement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/markets"
                className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-semibold text-[#14B8A6] hover:bg-gray-50 transition-colors shadow-lg"
              >
                Launch App
              </Link>
              <Link
                href="#"
                className="inline-flex items-center justify-center rounded-lg border-2 border-white px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Read Documentation
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FAF9FF] border-t border-gray-200 py-12">
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
            <p className="text-sm text-gray-500">© 2023 SpeculateX. All rights reserved.</p>
            <p className="text-sm text-gray-500 mt-2 md:mt-0">Built for the decentralized web</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
