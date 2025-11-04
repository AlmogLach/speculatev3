'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { coreAbi, usdcAbi } from '@/lib/abis';

export default function CreateMarketForm() {
  const { address } = useAccount();
  const [question, setQuestion] = useState('');
  const [yesName, setYesName] = useState('');
  const [yesSymbol, setYesSymbol] = useState('');
  const [noName, setNoName] = useState('');
  const [noSymbol, setNoSymbol] = useState('');
  const [initReserve, setInitReserve] = useState('1000'); // 1000e18 tokens per side
  const [feeBps, setFeeBps] = useState('300'); // 3% default (300 basis points)
  const [maxTradeBps, setMaxTradeBps] = useState('500'); // 5% max trade (500 basis points)
  const [initUsdc, setInitUsdc] = useState('1000'); // 1000 USDC initial liquidity
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  const { data: currentAllowance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: {
      enabled: !!(address && addresses.usdc && addresses.core),
    },
  });

  // Note: DirectCore doesn't require initial liquidity, so no approval needed for market creation
  // Approval will be needed when users want to trade

  useEffect(() => {
    if (isSuccess && !isApproving) {
      setQuestion('');
      setYesName('');
      setYesSymbol('');
      setNoName('');
      setNoSymbol('');
      setInitReserve('1000');
      setFeeBps('300');
      setMaxTradeBps('500');
      setInitUsdc('1000');
      alert('Market created successfully!');
      window.location.reload();
    }
  }, [isSuccess, isApproving]);

  // SpeculateCore requires initial liquidity deposit
  // Check if user has approved enough USDC
  useEffect(() => {
    if (address && addresses.core && currentAllowance !== undefined && currentAllowance !== null) {
      const requiredAmount = parseUnits(initUsdc || '0', 6);
      setNeedsApproval((currentAllowance as bigint) < requiredAmount);
    } else {
      setNeedsApproval(false);
    }
  }, [address, currentAllowance, initUsdc]);

  const handleApprove = async () => {
    if (!address || !addresses.core) return;
    
    setIsApproving(true);
    try {
      const amount = parseUnits(initUsdc || '1000', 6);
      await writeContract({
        address: addresses.usdc,
        abi: usdcAbi,
        functionName: 'approve',
        args: [addresses.core, amount],
      });
    } catch (error: any) {
      console.error('Error approving USDC:', error);
      alert(`Failed to approve USDC: ${error?.message || 'Unknown error'}`);
      setIsApproving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question || !yesName || !yesSymbol || !noName || !noSymbol || !initReserve || !feeBps || !maxTradeBps || !initUsdc) {
      alert('Please fill in all fields');
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

      const result = await writeContract({
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

      console.log('Create market transaction submitted:', result);
    } catch (error: any) {
      console.error('Error creating market:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`Failed to create market: ${errorMessage}`);
    }
  };

  // Reset approval state when transaction succeeds
  useEffect(() => {
    if (isSuccess && isApproving) {
      setIsApproving(false);
    }
  }, [isSuccess, isApproving]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will BTC reach $100k by 2026?"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </div>

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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Initial Reserve (tokens per side)
          </label>
          <input
            type="number"
            value={initReserve}
            onChange={(e) => setInitReserve(e.target.value)}
            min="1"
            step="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="1000"
            required
          />
          <p className="mt-1 text-xs text-gray-500">Amount in tokens (e.g., 1000 = 1000e18)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Initial USDC Liquidity
          </label>
          <input
            type="number"
            value={initUsdc}
            onChange={(e) => setInitUsdc(e.target.value)}
            min="1"
            step="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="1000"
            required
          />
          <p className="mt-1 text-xs text-gray-500">Amount in USDC (minimum 1 USDC)</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fee Rate (basis points, 0-1000)
          </label>
          <input
            type="number"
            value={feeBps}
            onChange={(e) => setFeeBps(e.target.value)}
            min="0"
            max="1000"
            step="10"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="300"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            {feeBps ? `${(parseInt(feeBps) / 100).toFixed(2)}%` : '0%'} fee per trade (300 = 3%)
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Trade (basis points, 10-10000)
          </label>
          <input
            type="number"
            value={maxTradeBps}
            onChange={(e) => setMaxTradeBps(e.target.value)}
            min="10"
            max="10000"
            step="10"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="500"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            {maxTradeBps ? `${(parseInt(maxTradeBps) / 100).toFixed(2)}%` : '0%'} of pool per trade (500 = 5%)
          </p>
        </div>
      </div>

      {needsApproval && (
        <div className="p-4 bg-yellow-50 rounded-md border border-yellow-200">
          <p className="text-sm text-yellow-800 mb-2">
            You need to approve USDC before creating the market.
          </p>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving || isPending || isConfirming}
            className="w-full rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 disabled:opacity-50"
          >
            {isApproving ? 'Approving...' : `Approve ${initUsdc} USDC`}
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || isConfirming || !address || needsApproval}
        className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
      >
        {(isPending || isConfirming) ? 'Creating Market...' : 'Create Market'}
      </button>
    </form>
  );
}
