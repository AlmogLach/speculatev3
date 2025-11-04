'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { getMarketCount } from '@/lib/hooks';

export default function Home() {
  const [marketCount, setMarketCount] = useState<number | null>(null);

  useEffect(() => {
    loadMarketCount();
  }, []);

  const loadMarketCount = async () => {
    try {
      const count = await getMarketCount();
      setMarketCount(Number(count));
    } catch (error) {
      console.error('Error loading market count:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center">
          <div className="mb-6 inline-flex items-center rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
            🚀 Live on Blockchain
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-7xl">
            Prediction Markets
            <span className="block text-green-600 mt-2">Powered by CPMM</span>
          </h1>
          <p className="mt-6 text-xl leading-8 text-gray-600 max-w-2xl mx-auto">
            Trade on any outcome with guaranteed solvency, instant liquidity, and transparent pricing.
            Built on pure Constant Product Market Maker (CPMM) technology.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/markets"
              className="rounded-md bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-lg hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 transition-all transform hover:scale-105"
            >
              Explore Markets →
            </Link>
            <Link
              href="/portfolio"
              className="rounded-md bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-lg hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 border border-gray-300 transition-all"
            >
              View Portfolio
            </Link>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-lg border border-gray-200">
            <div className="text-3xl font-bold text-green-600">
              {marketCount !== null ? marketCount : '...'}
            </div>
            <div className="mt-2 text-sm font-medium text-gray-600">Active Markets</div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-lg border border-gray-200">
            <div className="text-3xl font-bold text-blue-600">100%</div>
            <div className="mt-2 text-sm font-medium text-gray-600">Solvent</div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-lg border border-gray-200">
            <div className="text-3xl font-bold text-purple-600">~1%</div>
            <div className="mt-2 text-sm font-medium text-gray-600">Trading Fee</div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Why Choose SpeculateX?</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-lg bg-white p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Guaranteed Solvency</h3>
              <p className="text-gray-600">
                Every market is backed 1:1 with USDC reserves. Your funds are always redeemable at fair value.
              </p>
            </div>
            <div className="rounded-lg bg-white p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Instant Liquidity</h3>
              <p className="text-gray-600">
                CPMM provides continuous liquidity. Buy or sell positions instantly at fair market prices.
              </p>
            </div>
            <div className="rounded-lg bg-white p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Transparent Pricing</h3>
              <p className="text-gray-600">
                Real-time price discovery through market forces. Prices reflect true market sentiment.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-24 rounded-lg bg-gradient-to-r from-green-600 to-blue-600 p-12 text-white">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">1</div>
              <div className="font-semibold mb-1">Buy Position</div>
              <div className="text-sm opacity-90">Pay USDC to get YES/NO tokens</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">2</div>
              <div className="font-semibold mb-1">Prices Move</div>
              <div className="text-sm opacity-90">Token prices adjust with trading</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">3</div>
              <div className="font-semibold mb-1">Sell Anytime</div>
              <div className="text-sm opacity-90">Redeem tokens for USDC instantly</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">4</div>
              <div className="font-semibold mb-1">Profit/Loss</div>
              <div className="text-sm opacity-90">Keep winning positions or exit early</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

