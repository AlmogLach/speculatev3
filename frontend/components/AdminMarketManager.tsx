'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { addresses } from '@/lib/contracts';
import { coreAbi as SpeculateCoreABI } from '@/lib/abis';

interface Market {
  id: number;
  question: string;
  status: 'active' | 'paused' | 'resolved';
  totalPairs: number;
}

interface AdminMarketManagerProps {
  markets: Market[];
}

export default function AdminMarketManager({ markets }: AdminMarketManagerProps) {
  const [creating, setCreating] = useState(false);
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleResolve = async (marketId: number, yesWins: boolean) => {
    try {
      writeContract({
        address: addresses.core,
                abi: SpeculateCoreABI,
        functionName: 'resolveMarket',
        args: [BigInt(marketId), yesWins],
      });
    } catch (error) {
      console.error('Error resolving market:', error);
      alert('Failed to resolve market');
    }
  };

  const handlePause = async (marketId: number, pause: boolean) => {
    try {
      writeContract({
        address: addresses.core,
                abi: SpeculateCoreABI,
        functionName: pause ? 'pauseMarket' : 'unpauseMarket',
        args: [BigInt(marketId)],
      });
    } catch (error) {
      console.error('Error pausing market:', error);
      alert('Failed to pause/unpause market');
    }
  };

  // Reload when transaction succeeds
  useEffect(() => {
    if (isSuccess) {
      window.location.reload();
    }
  }, [isSuccess]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Manage Markets</h2>
      </div>

      <div className="space-y-4">
        {markets.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No markets yet</p>
        ) : (
          markets.map((market) => (
            <div
              key={market.id}
              className="flex items-center justify-between rounded-md border border-gray-200 p-4"
            >
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{market.question}</h3>
                <p className="text-sm text-gray-500">
                  Status: {market.status} • Pairs: {market.totalPairs}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePause(market.id, market.status === 'active')}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {market.status === 'active' ? 'Pause' : 'Unpause'}
                </button>
                <button
                  onClick={() => handleResolve(market.id, true)}
                  disabled={market.status === 'resolved'}
                  className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-500 disabled:opacity-50"
                >
                  Yes Wins
                </button>
                <button
                  onClick={() => handleResolve(market.id, false)}
                  disabled={market.status === 'resolved'}
                  className="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                >
                  No Wins
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
