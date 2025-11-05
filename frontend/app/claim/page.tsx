'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const { data: claimHash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: claimHash });

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
        
        if (statusNum === 2) {
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

          const yesWon = yesPrice > 0.9;
          const noWon = noPrice > 0.9;
          
          let claimableAmount = 0;
          let side: 'YES' | 'NO' = 'YES';
          let winning = false;

          if (yesWon && parseFloat(yesBalance) > 0) {
            claimableAmount = parseFloat(yesBalance) * yesPrice;
            side = 'YES';
            winning = true;
          } else if (noWon && parseFloat(noBalance) > 0) {
            claimableAmount = parseFloat(noBalance) * noPrice;
            side = 'NO';
            winning = true;
          }

          if (claimableAmount > 0) {
            totalAvailable += claimableAmount;
            rewards.push({
              marketId: i,
              question: market.question as string,
              resolvedDate: new Date().toISOString().split('T')[0],
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
      setClaimingId(null);
      loadClaimableRewards();
    }
  }, [isSuccess, loadClaimableRewards]);

  const handleClaim = async (reward: ClaimableReward) => {
    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    setClaimingId(reward.marketId);

    try {
      const market = await getMarket(BigInt(reward.marketId));
      const tokenAddress = reward.side === 'YES' 
        ? market.yes as `0x${string}`
        : market.no as `0x${string}`;
      
      const balance = reward.side === 'YES' ? reward.yesBalance : reward.noBalance;
      const tokensIn = parseUnits(balance, 18);
      
      const priceE6 = reward.side === 'YES' 
        ? BigInt(Math.floor(reward.yesPrice * 1e6))
        : BigInt(Math.floor(reward.noPrice * 1e6));
      
      const grossUsdc = (tokensIn * priceE6) / 10n**18n;
      const minUsdcOut = (grossUsdc * 95n) / 100n;

      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: positionTokenAbi,
        functionName: 'allowance',
        args: [address, addresses.core],
      });

      if (!allowance || (allowance as bigint) < tokensIn) {
        const approvalAmount = tokensIn * BigInt(1000);
        writeContract({
          address: tokenAddress,
          abi: positionTokenAbi,
          functionName: 'approve',
          args: [addresses.core, approvalAmount],
        });
        return;
      }

      writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: reward.side === 'YES' ? 'sellYes' : 'sellNo',
        args: [BigInt(reward.marketId), tokensIn, minUsdcOut],
      });
    } catch (error: any) {
      console.error('Error claiming reward:', error);
      setClaimingId(null);
      alert(`Failed to claim reward: ${error?.message || 'Unknown error'}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#FAF9FF] relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#14B8A6]/20 to-purple-400/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 20, repeat: Infinity }}
          />
        </div>

        <Header />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center bg-white rounded-2xl p-12 shadow-xl border border-gray-100 max-w-2xl mx-auto"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-[#14B8A6] to-[#0D9488] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Connect Your Wallet</h2>
            <p className="text-lg text-gray-600 mb-8">Please connect your wallet to view and claim your rewards from resolved markets.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9FF] relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#14B8A6]/20 to-purple-400/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-[#14B8A6]/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      <Header />
      
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Link */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="inline-flex items-center text-[#14B8A6] hover:text-[#0D9488] mb-8 font-semibold group">
            <motion.svg 
              className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </motion.svg>
            BACK TO HOME
          </Link>
        </motion.div>

        {/* Page Title */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-4 tracking-tight">
            Claim Your
            <span className="block bg-gradient-to-r from-[#14B8A6] to-[#0D9488] bg-clip-text text-transparent">
              Rewards
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Withdraw winnings from resolved prediction markets. Your funds are ready to claim instantly.
          </p>
        </motion.div>

        {/* Summary Cards */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
        >
          {/* Available to Claim */}
          <motion.div 
            whileHover={{ y: -5, scale: 1.02 }}
            className="relative overflow-hidden bg-gradient-to-br from-[#14B8A6] to-[#0D9488] rounded-2xl p-8 shadow-xl"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider">Available to Claim</h3>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </motion.div>
              </div>
              <motion.div 
                key={availableToClaim}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black text-white mb-3"
              >
                ${availableToClaim.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </motion.div>
              <p className="text-sm text-white/80 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {claimableRewards.length} {claimableRewards.length === 1 ? 'market' : 'markets'} ready
              </p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
          </motion.div>

          {/* Total Claimed */}
          <motion.div 
            whileHover={{ y: -5, scale: 1.02 }}
            className="relative overflow-hidden bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Total Claimed</h3>
              <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-5xl font-black text-gray-900 mb-3">
              ${totalClaimed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-gray-500">All-time earnings withdrawn</p>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex gap-2 mb-8 bg-white rounded-xl p-2 shadow-md border border-gray-100 w-fit"
        >
          <button
            onClick={() => setActiveTab('available')}
            className={`relative px-6 py-3 font-bold text-sm transition-all rounded-lg ${
              activeTab === 'available'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {activeTab === 'available' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] rounded-lg shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">Available to Claim</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`relative px-6 py-3 font-bold text-sm transition-all rounded-lg ${
              activeTab === 'history'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {activeTab === 'history' && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] rounded-lg shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">Claim History</span>
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
                    whileHover={{ y: -5, scale: 1.01 }}
                    className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:border-[#14B8A6] transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="px-3 py-1.5 bg-gradient-to-r from-green-400 to-green-500 text-white text-xs font-bold rounded-full shadow-md uppercase tracking-wide"
                          >
                            Claimable
                          </motion.span>
                          <span className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                            You bet {reward.side} • {reward.side} Won! 🎉
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">{reward.question}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Resolved: {reward.resolvedDate}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black bg-gradient-to-r from-[#14B8A6] to-[#0D9488] bg-clip-text text-transparent">
                            ${reward.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-sm font-semibold text-gray-500">USDC</span>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleClaim(reward)}
                        disabled={isPending || isConfirming || claimingId === reward.marketId}
                        className="px-8 py-4 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white rounded-xl font-bold hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap shadow-lg"
                      >
                        {(isPending || isConfirming) && claimingId === reward.marketId ? (
                          <span className="flex items-center gap-2">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                            />
                            Claiming...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Claim Reward
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </span>
                        )}
                      </motion.button>
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
                    className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-full uppercase tracking-wide">
                            Claimed
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">{reward.question}</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Claimed: {reward.resolvedDate}
                        </p>
                        <div className="text-3xl font-black text-gray-900">
                          ${reward.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="px-8 py-4 bg-gray-100 text-gray-500 rounded-xl font-bold whitespace-nowrap">
                        ✓ Claimed
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