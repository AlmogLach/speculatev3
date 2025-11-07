'use client';
// @ts-nocheck

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { useAccount, useWriteContract } from 'wagmi';
import { getMarketCount, getMarket, getPriceYes, getPriceNo, getMarketResolution } from '@/lib/hooks';
import { addresses } from '@/lib/contracts';
import { coreAbi, positionTokenAbi } from '@/lib/abis';
import { formatUnits, createPublicClient, http } from 'viem';
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

const CLAIMED_STORAGE_KEY = 'claimedRewards';

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [availableToClaim, setAvailableToClaim] = useState(0);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [claimableRewards, setClaimableRewards] = useState<ClaimableReward[]>([]);
  const [claimHistory, setClaimHistory] = useState<ClaimableReward[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();

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
      let storedHistory: ClaimableReward[] = [];
      try {
        const stored = localStorage.getItem(CLAIMED_STORAGE_KEY);
        if (stored) {
          storedHistory = JSON.parse(stored);
          setClaimHistory(storedHistory);
          setClaimedIds(new Set(storedHistory.map((r) => r.marketId)));
        } else {
          setClaimHistory([]);
          setClaimedIds(new Set());
        }
      } catch (error) {
        console.error('Failed to load claimed rewards from storage', error);
        setClaimHistory([]);
        setClaimedIds(new Set());
      }

      const claimedMap = new Map<number, ClaimableReward>();
      storedHistory.forEach((entry) => claimedMap.set(entry.marketId, entry));

      const count = await getMarketCount();
      const rewards: ClaimableReward[] = [];
      let totalAvailable = 0;

      for (let i = 1; i <= Number(count); i++) {
        const market = await getMarket(BigInt(i));
        if (!market.exists) {
          continue;
        }
        const resolution = await getMarketResolution(BigInt(i));
        
        // Only process resolved markets
        if (!resolution.isResolved) {
          continue;
        }
        
        const yesPrice = parseFloat(await getPriceYes(BigInt(i)));
        const noPrice = parseFloat(await getPriceNo(BigInt(i)));
        
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

        // Use the resolution config to determine winner
        const yesWon = resolution.yesWins;
        const noWon = !resolution.yesWins;
        
        let claimableAmount = 0;
        let side: 'YES' | 'NO' = 'YES';
        let winning = false;

        // Only show claimable if user has tokens for the winning side
        // In prediction markets, winning tokens are worth 1:1 USDC after resolution
        if (yesWon && parseFloat(yesBalance) > 0) {
          claimableAmount = parseFloat(yesBalance); // 1:1 USDC per token
          side = 'YES';
          winning = true;
        } else if (noWon && parseFloat(noBalance) > 0) {
          claimableAmount = parseFloat(noBalance); // 1:1 USDC per token
          side = 'NO';
          winning = true;
        }

        if (claimableAmount > 0) {
          // Format resolved date from expiry timestamp
          const resolvedDate = resolution.expiryTimestamp > 0n
            ? new Date(Number(resolution.expiryTimestamp) * 1000).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            : new Date().toISOString().split('T')[0];
          
          totalAvailable += claimableAmount;
          rewards.push({
            marketId: i,
            question: market.question as string,
            resolvedDate,
            amount: claimableAmount,
            side,
            winning,
            yesBalance,
            noBalance,
            yesPrice,
            noPrice,
          });
        } else if (winning) {
          if (!claimedMap.has(i)) {
            const resolvedDate = resolution.expiryTimestamp > 0n
              ? new Date(Number(resolution.expiryTimestamp) * 1000).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })
              : new Date().toISOString().split('T')[0];

            claimedMap.set(i, {
              marketId: i,
              question: market.question as string,
              resolvedDate,
              amount: claimedMap.get(i)?.amount ?? 0,
              side,
              winning: true,
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
      const historyList = Array.from(claimedMap.values());
      setClaimHistory(historyList);
      setClaimedIds(new Set(historyList.map((entry) => entry.marketId)));
      try {
        localStorage.setItem(CLAIMED_STORAGE_KEY, JSON.stringify(historyList));
      } catch (error) {
        console.error('Failed to persist claimed rewards', error);
      }
      // TODO: load total claimed from backend/subgraph
      setTotalClaimed(prev => prev);
    } catch (error) {
      console.error('Error loading claimable rewards:', error);
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, publicClient]);

  useEffect(() => {
    const total = claimHistory.reduce((acc, reward) => acc + reward.amount, 0);
    setTotalClaimed(total);
  }, [claimHistory]);

  useEffect(() => {
    loadClaimableRewards();
  }, [loadClaimableRewards]);

  const handleClaim = async (reward: ClaimableReward) => {
    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    setClaimingId(reward.marketId);

    try {
      const redeemHash = await writeContractAsync({
        address: addresses.core,
        abi: coreAbi,
        functionName: 'redeem',
        args: [BigInt(reward.marketId), reward.side === 'YES'],
      });
      await publicClient.waitForTransactionReceipt({ hash: redeemHash });

      setClaimHistory((prev) => {
        const filtered = prev.filter((r) => r.marketId !== reward.marketId);
        const updated = [...filtered, reward];
        try {
          localStorage.setItem(CLAIMED_STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.error('Failed to persist claimed rewards', error);
        }
        return updated;
      });
      setClaimedIds((prev) => {
        const next = new Set(prev);
        next.add(reward.marketId);
        return next;
      });
      setTotalClaimed((prev) => prev + reward.amount);
      loadClaimableRewards();
    } catch (error: any) {
      console.error('Error claiming reward:', error);
      setClaimingId(null);
      alert(`Failed to claim reward: ${error?.message || 'Unknown error'}`);
      return;
    }

    setClaimingId(null);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#F8F6FB] relative overflow-hidden">
        <Header />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center bg-white rounded-2xl p-8 sm:p-12 shadow-xl border border-gray-100 max-w-2xl mx-auto"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#2DD4BF] to-[#14B8A6] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">Connect Your Wallet</h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8">Please connect your wallet to view and claim your rewards from resolved markets.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6FB] relative overflow-hidden">
      <Header />
      
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        {/* Back Link */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="inline-flex items-center text-[#2DD4BF] hover:text-[#14B8A6] mb-4 sm:mb-6 md:mb-8 font-semibold group text-sm sm:text-base">
            <motion.svg 
              className="w-4 h-4 sm:w-5 sm:h-5 mr-2 group-hover:-translate-x-1 transition-transform"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </motion.svg>
            Back to Home
          </Link>
        </motion.div>

        {/* Page Title */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-6 sm:mb-8 md:mb-12"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-3 sm:mb-4 tracking-tight">
            Claim Your Rewards
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-2xl">
            Withdraw winnings from resolved prediction markets. Your funds are ready to claim instantly.
          </p>
        </motion.div>

        {/* Summary Cards */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-12"
        >
          {/* Available to Claim */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.01 }}
            className="relative overflow-hidden bg-[#F0FDF4] rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg border border-gray-100"
          >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">Available to Claim</h3>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-[#2DD4BF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#2DD4BF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
            </div>
            <motion.div 
              key={availableToClaim}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl sm:text-4xl md:text-5xl font-black text-[#2DD4BF] mb-2 sm:mb-3"
            >
              ${availableToClaim.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.div>
            <p className="text-xs sm:text-sm text-gray-500">
              {claimableRewards.length} {claimableRewards.length === 1 ? 'market' : 'markets'} ready for withdrawal
            </p>
          </motion.div>

          {/* Total Claimed */}
          <motion.div 
            whileHover={{ y: -2, scale: 1.01 }}
            className="relative overflow-hidden bg-[#F0FDF4] rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg border border-gray-100"
          >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Claimed</h3>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-2 sm:mb-3">
              ${totalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs sm:text-sm text-gray-500">All-time earnings withdrawn</p>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex gap-4 sm:gap-6 mb-6 sm:mb-8 border-b border-gray-200"
        >
          <button
            onClick={() => setActiveTab('available')}
            className={`relative pb-3 sm:pb-4 font-semibold text-sm sm:text-base transition-all ${
              activeTab === 'available'
                ? 'text-[#2DD4BF]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Available to Claim
            {activeTab === 'available' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`relative pb-3 sm:pb-4 font-semibold text-sm sm:text-base transition-all ${
              activeTab === 'history'
                ? 'text-[#2DD4BF]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Claim History
            {activeTab === 'history' && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        </motion.div>

        {/* Rewards List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="inline-block w-16 h-16 border-4 border-[#14B8A6] border-t-transparent rounded-full"
              />
              <p className="mt-6 text-lg font-semibold text-gray-600">Loading claimable rewards...</p>
            </motion.div>
          ) : activeTab === 'available' ? (
            <motion.div
              key="available"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {claimableRewards.length === 0 ? (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-2xl p-16 shadow-lg border border-gray-100 text-center"
                >
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-3">No rewards available</p>
                  <p className="text-gray-600 mb-8">You don&apos;t have any claimable rewards from resolved markets.</p>
                  <Link
                    href="/markets"
                    className="inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white font-bold rounded-lg hover:shadow-lg transition-all"
                  >
                    Explore Markets
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </motion.div>
              ) : (
                claimableRewards.map((reward, index) => (
                  <motion.div
                    key={reward.marketId}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -2, scale: 1.01 }}
                    className="bg-[#F0FDF4] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:border-[#2DD4BF] transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="px-2 sm:px-3 py-1 bg-[#2DD4BF] text-white text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wide"
                          >
                            Claimable
                          </motion.span>
                          <span className="px-2 sm:px-3 py-1 bg-green-50 text-green-700 text-[10px] sm:text-xs font-semibold rounded-full border border-green-200">
                            You bet {reward.side} - {reward.side} won
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-2 sm:mb-3 line-clamp-2">{reward.question}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                          Resolved: {reward.resolvedDate}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-col items-end sm:items-end gap-3 sm:gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">
                            ${reward.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleClaim(reward)}
                          disabled={
                            isPending ||
                            claimingId === reward.marketId ||
                            claimedIds.has(reward.marketId)
                          }
                          className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 bg-[#2DD4BF] hover:bg-[#14B8A6] text-white rounded-lg sm:rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-md text-xs sm:text-sm md:text-base"
                        >
                          {claimingId === reward.marketId ? (
                            <span className="flex items-center gap-2">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                              />
                              Claiming...
                            </span>
                          ) : claimedIds.has(reward.marketId) ? (
                            'Claimed'
                          ) : (
                            'Claim Reward'
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {claimHistory.length === 0 ? (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-2xl p-16 shadow-lg border border-gray-100 text-center"
                >
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-3">No claim history</p>
                  <p className="text-gray-600">Your claimed rewards will appear here.</p>
                </motion.div>
              ) : (
                claimHistory.map((reward, index) => (
                  <motion.div
                    key={reward.marketId}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-[#F0FDF4] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                          <span className="px-2 sm:px-3 py-1 bg-gray-200 text-gray-700 text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wide">
                            Claimed
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-2 sm:mb-3">{reward.question}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                          Claimed: {reward.resolvedDate}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-col items-end sm:items-end gap-3 sm:gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">
                            ${reward.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 bg-gray-200 text-gray-600 rounded-lg sm:rounded-xl font-bold whitespace-nowrap text-xs sm:text-sm md:text-base">
                          ✓ Claimed
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}