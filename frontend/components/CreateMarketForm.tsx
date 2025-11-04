'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { coreAbi, usdcAbi } from '@/lib/abis';

interface CreateMarketFormProps {
  standalone?: boolean; // If true, shows full page layout; if false, just the form
}

export default function CreateMarketForm({ standalone = false }: CreateMarketFormProps = { standalone: false }) {
  const { address } = useAccount();
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Crypto');
  const [resolutionDate, setResolutionDate] = useState('');
  const [initUsdc, setInitUsdc] = useState('5000');
  const [fundingGoal, setFundingGoal] = useState('10000');
  
  // Advanced fields (auto-generated but can be edited)
  const [yesName, setYesName] = useState('');
  const [yesSymbol, setYesSymbol] = useState('');
  const [noName, setNoName] = useState('');
  const [noSymbol, setNoSymbol] = useState('');
  const [initReserve, setInitReserve] = useState('1000');
  const [feeBps, setFeeBps] = useState('200'); // Contract uses default split, but we keep this for compatibility
  const [maxTradeBps, setMaxTradeBps] = useState('500');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApprovingState, setIsApprovingState] = useState(false);
  
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const { data: approvalHash, writeContract: writeApprove, isPending: isApproving } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });
  
  const { data: currentAllowance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: {
      enabled: !!(address && addresses.usdc && addresses.core),
    },
  });

  // Auto-generate token names and symbols from question
  useEffect(() => {
    if (question) {
      // Generate a short identifier from the question
      const shortId = question
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 20)
        .toUpperCase();
      
      if (!yesName || yesName === '') {
        setYesName(`${shortId} YES`);
      }
      if (!yesSymbol || yesSymbol === '') {
        setYesSymbol(`${shortId.substring(0, 10)}-YES`);
      }
      if (!noName || noName === '') {
        setNoName(`${shortId} NO`);
      }
      if (!noSymbol || noSymbol === '') {
        setNoSymbol(`${shortId.substring(0, 10)}-NO`);
      }
    }
  }, [question, yesName, yesSymbol, noName, noSymbol]);

  // Check approval status
  useEffect(() => {
    if (address && addresses.core && currentAllowance !== undefined && currentAllowance !== null) {
      const requiredAmount = parseUnits(initUsdc || '0', 6);
      setNeedsApproval((currentAllowance as bigint) < requiredAmount);
    } else {
      setNeedsApproval(false);
    }
  }, [address, currentAllowance, initUsdc]);

  // Reset form on success
  useEffect(() => {
    if (isSuccess && !isApprovingState) {
      setQuestion('');
      setDescription('');
      setCategory('Crypto');
      setResolutionDate('');
      setInitUsdc('5000');
      setFundingGoal('10000');
      setYesName('');
      setYesSymbol('');
      setNoName('');
      setNoSymbol('');
      setInitReserve('1000');
      setFeeBps('200');
      setMaxTradeBps('500');
      alert('Market created successfully!');
      window.location.reload();
    }
  }, [isSuccess, isApprovingState]);

  const handleApprove = async () => {
    if (!address || !addresses.core) return;
    
    setIsApprovingState(true);
    try {
      const amount = parseUnits(initUsdc || '5000', 6);
      writeApprove({
        address: addresses.usdc,
        abi: usdcAbi,
        functionName: 'approve',
        args: [addresses.core, amount],
      });
    } catch (error: any) {
      console.error('Error approving USDC:', error);
      alert(`Failed to approve USDC: ${error?.message || 'Unknown error'}`);
      setIsApprovingState(false);
    }
  };

  // Reset approval state when transaction succeeds
  useEffect(() => {
    if (isApprovalSuccess) {
      setIsApprovingState(false);
      setNeedsApproval(false);
    }
  }, [isApprovalSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question || !yesName || !yesSymbol || !noName || !noSymbol || !initReserve || !feeBps || !maxTradeBps || !initUsdc) {
      alert('Please fill in all required fields');
      return;
    }

    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    // Validate fee (0% to 10%)
    const fee = parseInt(feeBps);
    if (fee < 0 || fee > 1000) {
      alert('Fee must be between 0 and 1000 (0% to 10%) basis points');
      return;
    }

    // Validate max trade (0.1% to 100%)
    const maxTrade = parseInt(maxTradeBps);
    if (maxTrade < 10 || maxTrade > 10000) {
      alert('Max trade must be between 10 (0.1%) and 10000 (100%) basis points');
      return;
    }

    // Validate initial USDC (minimum 1 USDC)
    const initUsdcAmount = parseFloat(initUsdc);
    if (initUsdcAmount < 1) {
      alert('Initial USDC must be at least 1 USDC');
      return;
    }

    // Validate initial reserve (minimum 1e18)
    const initReserveAmount = parseFloat(initReserve);
    if (initReserveAmount < 1) {
      alert('Initial reserve must be at least 1 token');
      return;
    }

    if (needsApproval) {
      alert('Please approve USDC first');
      return;
    }

    try {
      const initReserveE18 = parseUnits(initReserve, 18);
      const initUsdcE6 = parseUnits(initUsdc, 6);

      console.log('Creating market:', {
        coreAddress: addresses.core,
        question,
        yesName,
        yesSymbol,
        noName,
        noSymbol,
        initReserveE18: initReserveE18.toString(),
        feeBps: fee,
        maxTradeBps: maxTrade,
        initUsdc: initUsdcE6.toString(),
      });

      writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: 'createMarket',
        args: [
          question,
          yesName,
          yesSymbol,
          noName,
          noSymbol,
          initReserveE18,
          fee as number,
          maxTrade as number,
          initUsdcE6,
        ],
      });
    } catch (error: any) {
      console.error('Error creating market:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`Failed to create market: ${errorMessage}`);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
                {/* Market Question */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Market Question
                  </label>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., Will BTC reach $150k by 2026?"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Make it clear and specific. This cannot be changed later.</p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide additional context or resolution criteria..."
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                  >
                    <option value="Crypto">Crypto</option>
                    <option value="Bitcoin">Bitcoin</option>
                    <option value="Ethereum">Ethereum</option>
                    <option value="Politics">Politics</option>
                    <option value="Sports">Sports</option>
                    <option value="Tech">Tech</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>

                {/* Resolution Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resolution Date
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={resolutionDate}
                      onChange={(e) => setResolutionDate(e.target.value)}
                      min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                    />
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">When will this market resolve? Minimum 7 days from now.</p>
                </div>

                {/* Initial Liquidity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Liquidity (USDC)
                  </label>
                  <input
                    type="number"
                    value={initUsdc}
                    onChange={(e) => setInitUsdc(e.target.value)}
                    placeholder="e.g., 5000"
                    min="1"
                    step="1"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                    required
                  />
                </div>

                {/* Funding Goal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Funding Goal (USDC)
                  </label>
                  <input
                    type="number"
                    value={fundingGoal}
                    onChange={(e) => setFundingGoal(e.target.value)}
                    placeholder="e.g., 10000"
                    min="1"
                    step="1"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"
                  />
                  <p className="mt-1 text-xs text-gray-500">Optional: Target funding goal for this market</p>
                </div>

                {/* Advanced Options Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-[#14B8A6] hover:text-[#0D9488] font-medium"
                  >
                    {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Options
                  </button>
                </div>

                {/* Advanced Options */}
                {showAdvanced && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          YES Token Name
                        </label>
                        <input
                          type="text"
                          value={yesName}
                          onChange={(e) => setYesName(e.target.value)}
                          placeholder="BTC100K YES"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          YES Token Symbol
                        </label>
                        <input
                          type="text"
                          value={yesSymbol}
                          onChange={(e) => setYesSymbol(e.target.value)}
                          placeholder="BTC100K-YES"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          NO Token Name
                        </label>
                        <input
                          type="text"
                          value={noName}
                          onChange={(e) => setNoName(e.target.value)}
                          placeholder="BTC100K NO"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          NO Token Symbol
                        </label>
                        <input
                          type="text"
                          value={noSymbol}
                          onChange={(e) => setNoSymbol(e.target.value)}
                          placeholder="BTC100K-NO"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Initial Reserve (tokens)
                        </label>
                        <input
                          type="number"
                          value={initReserve}
                          onChange={(e) => setInitReserve(e.target.value)}
                          min="1"
                          step="1"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          placeholder="1000"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">Tokens per side (e.g., 1000 = 1000e18)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Max Trade (basis points)
                        </label>
                        <input
                          type="number"
                          value={maxTradeBps}
                          onChange={(e) => setMaxTradeBps(e.target.value)}
                          min="10"
                          max="10000"
                          step="10"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          placeholder="500"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {maxTradeBps ? `${(parseInt(maxTradeBps) / 100).toFixed(2)}%` : '0%'} of pool per trade
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approval Notice */}
                {needsApproval && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800 mb-3">
                      You need to approve USDC before creating the market.
                    </p>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApproving || isApprovalConfirming || isPending || isConfirming}
                      className="w-full rounded-lg bg-yellow-600 px-4 py-3 text-sm font-semibold text-white hover:bg-yellow-500 disabled:opacity-50 transition-colors"
                    >
                      {(isApproving || isApprovalConfirming) ? 'Approving...' : `Approve ${initUsdc} USDC`}
                    </button>
                  </div>
                )}

                {/* Create Market Button */}
                <button
                  type="submit"
                  disabled={isPending || isConfirming || !address || needsApproval}
                  className="w-full rounded-lg bg-[#14B8A6] px-6 py-4 text-base font-semibold text-white hover:bg-[#0D9488] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {(isPending || isConfirming) ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Creating Market...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Market
                    </>
                  )}
                </button>
    </form>
  );

  const sidebarContent = (
    <div className="bg-green-50 rounded-xl p-6 shadow-lg border border-green-200 sticky top-4">
              {/* How It Works */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
                <ol className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-[#14B8A6] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">Set Terms</p>
                      <p className="text-sm text-gray-600">Define your market question and resolution date.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-[#14B8A6] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">Add Liquidity</p>
                      <p className="text-sm text-gray-600">Provide initial liquidity to bootstrap trading.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-[#14B8A6] text-white rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">Earn Fees</p>
                      <p className="text-sm text-gray-600">Collect 0.5% of all trading volume on your market.</p>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Pro Tips */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Pro Tips
                </h3>
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6] mt-1">•</span>
                    <span>Use clear, unambiguous market questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6] mt-1">•</span>
                    <span>Set realistic resolution criteria</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6] mt-1">•</span>
                    <span>Higher liquidity attracts more traders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6] mt-1">•</span>
                    <span>Markets resolve in 24-48 hours</span>
                  </li>
                </ul>
              </div>
            </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-[#FAF9FF]">
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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Create Your Market</h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Launch a new prediction market on any outcome. Set the terms, attract liquidity providers, and earn fees from your market.
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
                {formContent}
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="lg:col-span-1">
              {sidebarContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Embedded version (for admin page)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Form */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          {formContent}
        </div>
      </div>

      {/* Right Column - Sidebar */}
      <div className="lg:col-span-1">
        {sidebarContent}
      </div>
    </div>
  );
}
