'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import CreateMarketForm from '@/components/CreateMarketForm';
import AdminMarketManager from '@/components/AdminMarketManager';
import MintUsdcForm from '@/components/MintUsdcForm';
import SensitivityManager from '@/components/SensitivityManager';
import Header from '@/components/Header';
import { getMarketCount, getMarket } from '@/lib/hooks';
import { addresses } from '@/lib/contracts';
import { formatUnits } from 'viem';

interface Market {
  id: number;
  question: string;
  status: 'active' | 'paused' | 'resolved';
  totalPairs: number;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      // Check if user is admin
      setIsAdmin(address.toLowerCase() === addresses.admin.toLowerCase());
      loadMarkets();
    }
  }, [isConnected, address]);

  const loadMarkets = async () => {
    try {
      const count = await getMarketCount();
      const marketArray: Market[] = [];
      
      for (let i = 1; i <= Number(count); i++) {
        const market = await getMarket(BigInt(i));
        const statusNames = ['active', 'paused', 'resolved'] as const;
        
        marketArray.push({
          id: i,
          question: market.question as string,
          status: statusNames[Number(market.status)],
          totalPairs: Number(formatUnits(market.totalPairs as bigint, 6)),
        });
      }
      
      setMarkets(marketArray);
    } catch (error) {
      console.error('Error loading markets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Panel</h1>
          <p className="text-gray-600">Please connect your wallet</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Panel</h1>
          <p className="text-red-600">Access denied. Only admin can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Panel</h1>
        
        <div className="mb-8">
          <MintUsdcForm />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Market</h2>
            <CreateMarketForm />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Price Sensitivity</h2>
            <SensitivityManager />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Manage Markets</h2>
            {loading ? (
              <p className="text-gray-500">Loading markets...</p>
            ) : (
              <AdminMarketManager markets={markets} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
