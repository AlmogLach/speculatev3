'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getMarketCount, getMarket, getPriceYes, getPriceNo } from '@/lib/hooks';
import { addresses } from '@/lib/contracts';
import { coreAbi, positionTokenAbi } from '@/lib/abis';
import { formatUnits, parseUnits, createPublicClient, http } from 'viem';
import { bscTestnet } from 'viem/chains';

interface ClaimableReward {
  marketId: number;
  question: string;
  resolvedDate: string;
  amount: number;
  side: 'YES' | 'NO';
  winning: boolean;
  yesBalance: string;
  noBalance: string;
  yesPrice: number;
  noPrice: number;
}

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [availableToClaim, setAvailableToClaim] = useState(0);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [claimableRewards, setClaimableRewards] = useState<ClaimableReward[]>([]);
  const [claimHistory, setClaimHistory] = useState<ClaimableReward[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: claimHash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: claimHash });

  // Create public client once
  const publicClient = useMemo(() => createPublicClient({
    chain: bscTestnet,
    transport: http(),
  }), []);

  const loadClaimableRewards = useCallback(async () => {
    if (!address || !isConnected) {
      setLoading(false);
      return;
    }

    try {
      const count = await getMarketCount();
      const rewards: ClaimableReward[] = [];
      let totalAvailable = 0;

      for (let i = 1; i <= Number(count); i++) {
        const market = await getMarket(BigInt(i));
        const statusNum = Number(market.status);
        
        // Only process resolved markets (status = 2)
        if (statusNum === 2) {
          const yesPrice = parseFloat(await getPriceYes(BigInt(i)));
          const noPrice = parseFloat(await getPriceNo(BigInt(i)));
          
          // Get user token balances using publicClient
          let yesBalance = '0';
          let noBalance = '0';
          
          try {
            const yesBal = await publicClient.readContract({
              address: market.yes as `0x${string}`,
              abi: positionTokenAbi,
              functionName: 'balanceOf',
              args: [address],
            });
            yesBalance = formatUnits(yesBal as bigint, 18);
          } catch (e) {
            console.error('Error fetching YES balance:', e);
          }

          try {
            const noBal = await publicClient.readContract({
              address: market.no as `0x${string}`,
              abi: positionTokenAbi,
              functionName: 'balanceOf',
              args: [address],
            });
            noBalance = formatUnits(noBal as bigint, 18);
          } catch (e) {
            console.error('Error fetching NO balance:', e);
          }

          // Determine winning side based on price
          // In a resolved market, the winning side should have price close to 1.0
          const yesWon = yesPrice > 0.9;
          const noWon = noPrice > 0.9;
          
          let claimableAmount = 0;
          let side: 'YES' | 'NO' = 'YES';
          let winning = false;

          if (yesWon && parseFloat(yesBalance) > 0) {
            // User has winning YES tokens
            claimableAmount = parseFloat(yesBalance) * yesPrice;
            side = 'YES';
            winning = true;
          } else if (noWon && parseFloat(noBalance) > 0) {
            // User has winning NO tokens
            claimableAmount = parseFloat(noBalance) * noPrice;
            side = 'NO';
            winning = true;
          }

          if (claimableAmount > 0) {
            totalAvailable += claimableAmount;
            rewards.push({
              marketId: i,
              question: market.question as string,
              resolvedDate: new Date().toISOString().split('T')[0], // Placeholder - would need actual resolution date
              amount: claimableAmount,
              side,
              winning,
              yesBalance,
              noBalance,
              yesPrice,
              noPrice,
            });
          }
        }
      }

      setClaimableRewards(rewards);
      setAvailableToClaim(totalAvailable);
      // Placeholder for total claimed - would need to track from events
      setTotalClaimed(5200.50);
    } catch (error) {
      console.error('Error loading claimable rewards:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient]);

  useEffect(() => {
    loadClaimableRewards();
  }, [loadClaimableRewards]);

  useEffect(() => {
    if (isSuccess) {
      loadClaimableRewards();
      alert('Reward claimed successfully!');
    }
  }, [isSuccess, loadClaimableRewards]);

  const handleClaim = async (reward: ClaimableReward) => {
    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    try {
      const market = await getMarket(BigInt(reward.marketId));
      const tokenAddress = reward.side === 'YES' 
        ? market.yes as `0x${string}`
        : market.no as `0x${string}`;
      
      const balance = reward.side === 'YES' ? reward.yesBalance : reward.noBalance;
      const tokensIn = parseUnits(balance, 18);
      
      // For resolved markets, we sell the winning tokens at their current price
      // Calculate minimum USDC output (with 5% slippage tolerance)
      const priceE6 = reward.side === 'YES' 
        ? BigInt(Math.floor(reward.yesPrice * 1e6))
        : BigInt(Math.floor(reward.noPrice * 1e6));
      
      const grossUsdc = (tokensIn * priceE6) / 10n**18n;
      const minUsdcOut = (grossUsdc * 95n) / 100n; // 5% slippage tolerance

      // Check if we need to approve tokens first
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: positionTokenAbi,
        functionName: 'allowance',
        args: [address, addresses.core],
      });

      if (!allowance || (allowance as bigint) < tokensIn) {
        // Approve first
        const approvalAmount = tokensIn * BigInt(1000);
        writeContract({
          address: tokenAddress,
          abi: positionTokenAbi,
          functionName: 'approve',
          args: [addresses.core, approvalAmount],
        });
        alert('Please wait for approval to confirm, then try claiming again.');
        return;
      }

      // Sell the winning tokens
      writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: reward.side === 'YES' ? 'sellYes' : 'sellNo',
        args: [BigInt(reward.marketId), tokensIn, minUsdcOut],
      });
    } catch (error: any) {
      console.error('Error claiming reward:', error);
      alert(`Failed to claim reward: ${error?.message || 'Unknown error'}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#FAF9FF]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Please connect your wallet to view claimable rewards</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9FF]">
      <Header />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center text-[#14B8A6] hover:text-[#0D9488] mb-6">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Claim Your Rewards</h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Withdraw winnings from resolved prediction markets. Your funds are ready to claim instantly.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Available to Claim */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 relative">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Available to Claim</h3>
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="text-4xl font-bold text-green-600 mb-2">
              ${availableToClaim.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-gray-500">
              {claimableRewards.length} {claimableRewards.length === 1 ? 'market' : 'markets'} ready for withdrawal
            </p>
          </div>

          {/* Total Claimed */}
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 relative">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Claimed</h3>
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-2">
              ${totalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-gray-500">All-time earnings withdrawn</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('available')}
            className={`pb-3 px-4 font-semibold text-sm transition-colors ${
              activeTab === 'available'
                ? 'text-[#14B8A6] border-b-2 border-[#14B8A6]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Available to Claim
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 font-semibold text-sm transition-colors ${
              activeTab === 'history'
                ? 'text-[#14B8A6] border-b-2 border-[#14B8A6]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Claim History
          </button>
        </div>

        {/* Rewards List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#14B8A6]"></div>
            <p className="mt-4 text-gray-600">Loading claimable rewards...</p>
          </div>
        ) : activeTab === 'available' ? (
          <div className="space-y-4">
            {claimableRewards.length === 0 ? (
              <div className="bg-white rounded-xl p-12 shadow-lg border border-gray-200 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-lg font-semibold text-gray-900 mb-2">No rewards available</p>
                <p className="text-gray-600">You don't have any claimable rewards from resolved markets.</p>
              </div>
            ) : (
              claimableRewards.map((reward) => (
                <div key={reward.marketId} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          CLAIMABLE
                        </span>
                        <span className="px-2 py-1 bg-green-50 text-green-800 text-xs font-medium rounded">
                          You bet {reward.side} - {reward.side} won
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{reward.question}</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Resolved: {reward.resolvedDate}
                      </p>
                      <div className="text-2xl font-bold text-gray-900">
                        ${reward.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <button
                      onClick={() => handleClaim(reward)}
                      disabled={isPending || isConfirming}
                      className="ml-4 px-6 py-3 bg-[#14B8A6] text-white rounded-lg font-semibold hover:bg-[#0D9488] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {(isPending || isConfirming) ? 'Claiming...' : 'Claim Reward'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {claimHistory.length === 0 ? (
              <div className="bg-white rounded-xl p-12 shadow-lg border border-gray-200 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-lg font-semibold text-gray-900 mb-2">No claim history</p>
                <p className="text-gray-600">Your claimed rewards will appear here.</p>
              </div>
            ) : (
              claimHistory.map((reward) => (
                <div key={reward.marketId} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                          CLAIMED
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{reward.question}</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Claimed: {reward.resolvedDate}
                      </p>
                      <div className="text-2xl font-bold text-gray-900">
                        ${reward.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="ml-4 px-6 py-3 bg-gray-100 text-gray-600 rounded-lg font-semibold whitespace-nowrap">
                      Claimed
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

