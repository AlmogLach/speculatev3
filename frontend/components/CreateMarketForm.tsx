'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { coreAbi, usdcAbi } from '@/lib/abis';

export default function CreateMarketForm() {
  const { address } = useAccount();
  const [question, setQuestion] = useState('');
  const [initialPrice, setInitialPrice] = useState('0.5'); // 0.5 = 50% for YES
  const [expiry, setExpiry] = useState('');
  const [feeBps, setFeeBps] = useState('200'); // 2% default (200 basis points)
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
      setInitialPrice('0.5');
      setExpiry('');
      setFeeBps('200');
      alert('Market created successfully!');
      window.location.reload();
    }
  }, [isSuccess, isApproving]);

  // DirectCore doesn't require initial liquidity deposit
  // Markets start with 0 vault and users add liquidity through trades

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question || !initialPrice || !expiry || !feeBps) {
      alert('Please fill in all fields');
      return;
    }

    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    // Validate initial price (0.01 to 0.99)
    const price = parseFloat(initialPrice);
    if (price <= 0.01 || price >= 0.99) {
      alert('Initial price must be between 0.01 and 0.99 (1% to 99%)');
      return;
    }

    // Validate fee (0.1% to 10%)
    const fee = parseInt(feeBps);
    if (fee < 10 || fee > 1000) {
      alert('Fee must be between 10 (0.1%) and 1000 (10%) basis points');
      return;
    }

    if (!addresses.core || addresses.core === '0x0000000000000000000000000000000000000000') {
      alert('Core contract address not configured');
      return;
    }

    if (!addresses.usdc || addresses.usdc === '0x0000000000000000000000000000000000000000') {
      alert('USDC address not configured');
      return;
    }

    try {
      const expiryTimestamp = BigInt(Math.floor(new Date(expiry).getTime() / 1000));
      // Convert price (0.5) to E18 (0.5e18 = 500000000000000000)
      const initialPriceE18 = BigInt(Math.floor(price * 1e18));

      console.log('Creating market:', {
        coreAddress: addresses.core,
        usdcAddress: addresses.usdc,
        question,
        initialPrice: price,
        initialPriceE18: initialPriceE18.toString(),
        feeBps: fee,
        expiry: expiryTimestamp.toString(),
      });

      const result = await writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: 'createMarket',
        args: [
          addresses.usdc,
          question,
          expiryTimestamp,
          fee as number, // feeBps (basis points)
          initialPriceE18, // initialPriceYesE18
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Initial Price (YES probability, 0.01 to 0.99)
        </label>
        <input
          type="number"
          value={initialPrice}
          onChange={(e) => setInitialPrice(e.target.value)}
          min="0.01"
          max="0.99"
          step="0.01"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="0.5"
          required
        />
        <p className="mt-1 text-xs text-gray-500">0.5 = 50% YES / 50% NO</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fee Rate (basis points, 10-1000)
        </label>
        <input
          type="number"
          value={feeBps}
          onChange={(e) => setFeeBps(e.target.value)}
          min="10"
          max="1000"
          step="10"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="200"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          {feeBps ? `${(parseInt(feeBps) / 100).toFixed(2)}%` : '0%'} fee per trade (100 = 1%, 200 = 2%, etc.)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Expiry Date
        </label>
        <input
          type="datetime-local"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isPending || isConfirming || !address}
        className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
      >
        {(isPending || isConfirming) ? 'Creating Market...' : 'Create Market'}
      </button>
    </form>
  );
}
