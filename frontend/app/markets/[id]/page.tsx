'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import TradingCard from '@/components/TradingCard';
import Header from '@/components/Header';
import { getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { formatUnits } from 'viem';

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.id as string;
  const { isConnected } = useAccount();
  const [market, setMarket] = useState<any>(null);
  const [priceYes, setPriceYes] = useState('0');
  const [priceNo, setPriceNo] = useState('0');
  const [loading, setLoading] = useState(true);

  const loadMarket = useCallback(async () => {
    if (!marketId) return;
    try {
      const data = await getMarket(BigInt(marketId));
      const yesPrice = await getPriceYes(BigInt(marketId));
      const noPrice = await getPriceNo(BigInt(marketId));
      
      setMarket(data);
      setPriceYes((parseFloat(yesPrice) * 100).toFixed(2));
      setPriceNo((parseFloat(noPrice) * 100).toFixed(2));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-600">Loading market...</p>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-red-600">Market not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {market.question}
          </h1>
          <div className="flex items-center gap-8">
            <div className="text-center bg-green-50 rounded-lg p-4 border border-green-200">
              <p className="text-sm font-medium text-green-700 mb-2">YES</p>
              <p className="text-2xl font-bold text-green-600 mb-1">{priceYes}%</p>
              <p className="text-sm text-green-600/70">${(parseFloat(priceYes) / 100).toFixed(3)} USD</p>
            </div>
            <div className="text-center bg-red-50 rounded-lg p-4 border border-red-200">
              <p className="text-sm font-medium text-red-700 mb-2">NO</p>
              <p className="text-2xl font-bold text-red-600 mb-1">{priceNo}%</p>
              <p className="text-sm text-red-600/70">${(parseFloat(priceNo) / 100).toFixed(3)} USD</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {isConnected ? (
              <TradingCard marketId={parseInt(marketId)} question={market.question} />
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <p className="text-center text-gray-600">Connect wallet to trade</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Market Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Vault (USDC):</span>
                  <span className="font-medium">{market.usdcVault ? formatUnits(market.usdcVault as bigint, 6) : '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Pairs (USDC):</span>
                  <span className="font-medium">{market.totalPairsUSDC ? formatUnits(market.totalPairsUSDC as bigint, 6) : '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fee (Buy):</span>
                  <span className="font-medium">
                    {market.feeTreasuryBps && market.feeVaultBps && market.feeLpBps
                      ? `${(Number(market.feeTreasuryBps) + Number(market.feeVaultBps) + Number(market.feeLpBps)) / 100}%`
                      : market.feeBps ? `${Number(market.feeBps) / 100}%` : '0%'}
                  </span>
                </div>
                {market.feeTreasuryBps && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>├─ Treasury:</span>
                    <span>{Number(market.feeTreasuryBps) / 100}%</span>
                  </div>
                )}
                {market.feeVaultBps && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>├─ Vault Buffer:</span>
                    <span>{Number(market.feeVaultBps) / 100}%</span>
                  </div>
                )}
                {market.feeLpBps && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>└─ LP:</span>
                    <span>{Number(market.feeLpBps) / 100}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Fee (Sell):</span>
                  <span className="font-medium">{market.sellFees ? `${((Number(market.feeTreasuryBps) || 0) + (Number(market.feeVaultBps) || 0) + (Number(market.feeLpBps) || 0)) / 100}%` : '0% (Free)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Trade:</span>
                  <span className="font-medium">{market.maxTradeBps ? `${Number(market.maxTradeBps) / 100}%` : '0%'}</span>
                </div>
                {market.lp && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">LP Address:</span>
                    <span className="font-mono text-xs">{String(market.lp).slice(0, 6)}...{String(market.lp).slice(-4)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium capitalize">{['Active', 'Paused', 'Resolved'][Number(market.status)]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

