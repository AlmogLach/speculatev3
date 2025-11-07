'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import CreateMarketForm from '@/components/CreateMarketForm';
import AdminMarketManager from '@/components/AdminMarketManager';
import MintUsdcForm from '@/components/MintUsdcForm';
import AdminManager from '@/components/AdminManager';
import USDCMinterManager from '@/components/USDCMinterManager';
import Header from '@/components/Header';
import { getMarketCount, getMarket, isAdmin as checkIsAdmin } from '@/lib/hooks';
import { addresses } from '@/lib/contracts';
import { formatUnits } from 'viem';

interface Market {
  id: number;
  question: string;
  status: 'active' | 'resolved';
  totalPairs: number;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (isConnected && address) {
        // Check if user is admin (checks both primary admin and admins mapping)
        const adminStatus = await checkIsAdmin(address);
        setIsAdmin(adminStatus);
        loadMarkets();
      }
    };
    checkAdmin();
  }, [isConnected, address]);

  const loadMarkets = async () => {
    try {
      const count = await getMarketCount();
      const marketArray: Market[] = [];
      
      for (let i = 1; i <= Number(count); i++) {
        const market = await getMarket(BigInt(i));
        if (!market.exists) continue;

        const statusNames = ['active', 'resolved'] as const;

        marketArray.push({
          id: i,
          question: market.question as string,
          status: statusNames[Math.min(Number(market.status), 1)],
          totalPairs: Number(formatUnits(market.totalPairsUSDC as bigint, 6)),
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
      <div className="min-h-screen bg-[#FAF9FF]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Panel</h1>
            <p className="text-gray-600">Please connect your wallet to access the admin panel</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAF9FF]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl p-8 shadow-lg border border-red-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Panel</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 font-semibold">Access Denied</p>
              <p className="text-red-600 text-sm mt-2">Only administrators can access this page. Your address ({address?.slice(0, 6)}...{address?.slice(-4)}) is not authorized.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9FF]">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-600">Manage markets, admins, and system settings</p>
        </div>
        
        <div className="mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">USDC Minting</h2>
            <MintUsdcForm />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Market</h2>
            <CreateMarketForm />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Management</h2>
            <AdminManager />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">USDC Minter Management</h2>
            <USDCMinterManager />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Manage Markets</h2>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#14B8A6]"></div>
                <p className="mt-4 text-gray-500">Loading markets...</p>
              </div>
            ) : (
              <AdminMarketManager markets={markets} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
