'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { parseUnits, keccak256, stringToBytes } from 'viem';
import { addresses } from '@/lib/contracts';
import { coreAbi, usdcAbi } from '@/lib/abis';

interface CreateMarketFormProps {
  standalone?: boolean;
}

export default function CreateMarketForm({
  standalone = false,
}: CreateMarketFormProps = { standalone: false }) {
  const { address } = useAccount();

  // Base state
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Crypto');
  const [resolutionDate, setResolutionDate] = useState('');

  // Liquidity + reserve (auto-balance 0.5 USD/token)
  const [initUsdc, setInitUsdc] = useState('1000');
  const [initReserve, setInitReserve] = useState('2000');

  // Chainlink
  const [oracleType, setOracleType] = useState<'none' | 'chainlink'>('none');
  const [priceFeedSymbol, setPriceFeedSymbol] = useState('BTC/USD');
  const [targetValue, setTargetValue] = useState('');
  const [comparison, setComparison] = useState<'above' | 'below' | 'equals'>(
    'above'
  );

  // Tokens
  const [yesName, setYesName] = useState('');
  const [yesSymbol, setYesSymbol] = useState('');
  const [noName, setNoName] = useState('');
  const [noSymbol, setNoSymbol] = useState('');
  const [feeBps, setFeeBps] = useState('200');
  const [maxTradeBps, setMaxTradeBps] = useState('500');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Approvals
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApprovingState, setIsApprovingState] = useState(false);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const {
    data: approvalHash,
    writeContract: writeApprove,
    isPending: isApproving,
  } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } =
    useWaitForTransactionReceipt({ hash: approvalHash });

  const { data: currentAllowance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args:
      address && addresses.core ? [address, addresses.core] : undefined,
    query: { enabled: !!(address && addresses.usdc && addresses.core) },
  });

  const { data: usdcBalance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Auto-balance 2x reserve
  useEffect(() => {
    const usdcNum = parseFloat(initUsdc || '0');
    if (!isNaN(usdcNum) && usdcNum > 0) {
      setInitReserve((usdcNum * 2).toFixed(2));
    }
  }, [initUsdc]);

  // Auto token names
  useEffect(() => {
    if (question) {
      const shortId = question
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 20)
        .toUpperCase();
      if (!yesName) setYesName(`${shortId} YES`);
      if (!yesSymbol) setYesSymbol(`${shortId.substring(0, 10)}-YES`);
      if (!noName) setNoName(`${shortId} NO`);
      if (!noSymbol) setNoSymbol(`${shortId.substring(0, 10)}-NO`);
    }
  }, [question]);

  // Allowance check
  useEffect(() => {
    if (
      address &&
      addresses.core &&
      currentAllowance !== undefined &&
      currentAllowance !== null
    ) {
      const requiredAmount = parseUnits(initUsdc || '0', 6);
      setNeedsApproval((currentAllowance as bigint) < requiredAmount);
    } else {
      setNeedsApproval(false);
    }
  }, [address, currentAllowance, initUsdc]);

  // Reset form on success
  useEffect(() => {
    if (isSuccess && !isApprovingState) {
      alert('✅ Market created successfully!');
      window.location.reload();
    }
  }, [isSuccess, isApprovingState]);

  // Approve
  const handleApprove = async () => {
    if (!address || !addresses.core) return;
    setIsApprovingState(true);
    try {
      const amount = parseUnits(initUsdc || '1000', 6);
      writeApprove({
        address: addresses.usdc,
        abi: usdcAbi,
        functionName: 'approve',
        args: [addresses.core, amount],
      });
    } catch (err: any) {
      alert(`Approval failed: ${err.message || 'Unknown error'}`);
      setIsApprovingState(false);
    }
  };

  useEffect(() => {
    if (isApprovalSuccess) {
      setIsApprovingState(false);
      setNeedsApproval(false);
    }
  }, [isApprovalSuccess]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) return alert('Please connect your wallet');
    if (!question) return alert('Enter question');
    if (!resolutionDate) return alert('Select resolution date');
    if (needsApproval) return alert('Approve USDC first');

    const fee = parseInt(feeBps);
    const maxTrade = parseInt(maxTradeBps);
    const initReserveE18 = parseUnits(initReserve, 18);
    const initUsdcE6 = parseUnits(initUsdc, 6);
    const expiry = Math.floor(new Date(resolutionDate).getTime() / 1000);
    const oracleEnum = oracleType === 'none' ? 0 : 1;
    const comparisonEnum =
      comparison === 'above' ? 0 : comparison === 'below' ? 1 : 2;
    const targetValueBigInt =
      oracleType === 'chainlink' && targetValue
        ? parseUnits(targetValue, 8)
        : 0n;
    const priceFeedId =
      oracleType === 'chainlink'
        ? (keccak256(stringToBytes(priceFeedSymbol)) as `0x${string}`)
        : ('0x' + '0'.repeat(64)) as `0x${string}`;

    try {
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
          fee,
          maxTrade,
          initUsdcE6,
          BigInt(expiry),
          oracleEnum,
          '0x0000000000000000000000000000000000000000',
          priceFeedId,
          targetValueBigInt,
          comparisonEnum,
        ],
      });
    } catch (err: any) {
      alert(`Failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Form UI
  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Market Question */}
      <div>
        <label className="font-bold block mb-2">Market Question *</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Will BTC reach $100K by 2026?"
          className="w-full border rounded-lg px-4 py-3"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="font-bold block mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details or criteria..."
          className="w-full border rounded-lg px-4 py-3"
        />
      </div>

      {/* Category */}
      <div>
        <label className="font-bold block mb-2">Category</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Crypto"
          className="w-full border rounded-lg px-4 py-3"
        />
      </div>

      {/* Resolution Date */}
      <div>
        <label className="font-bold block mb-2">Resolution Date *</label>
        <input
          type="datetime-local"
          value={resolutionDate}
          onChange={(e) => setResolutionDate(e.target.value)}
          className="w-full border rounded-lg px-4 py-3"
          required
        />
      </div>

      {/* Resolution Type */}
      <div>
        <label className="font-bold block mb-2">Resolution Type *</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="oracleType"
              value="none"
              checked={oracleType === 'none'}
              onChange={() => setOracleType('none')}
            />
            Manual Resolution
          </label>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="oracleType"
              value="chainlink"
              checked={oracleType === 'chainlink'}
              onChange={() => setOracleType('chainlink')}
            />
            Chainlink Auto-Resolution
          </label>
        </div>
      </div>

      {/* Chainlink Config */}
      {oracleType === 'chainlink' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
          <h3 className="font-semibold text-gray-900">
            Chainlink Configuration
          </h3>
          <div>
            <label className="block mb-1">Price Feed Symbol *</label>
            <select
              value={priceFeedSymbol}
              onChange={(e) => setPriceFeedSymbol(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="BTC/USD">BTC/USD</option>
              <option value="ETH/USD">ETH/USD</option>
              <option value="BNB/USD">BNB/USD</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Target Value *</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block mb-1">Comparison *</label>
              <select
                value={comparison}
                onChange={(e) =>
                  setComparison(e.target.value as 'above' | 'below' | 'equals')
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
                <option value="equals">Equals</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Initial Liquidity */}
      <div>
        <label className="font-bold block mb-2">
          Initial Liquidity (USDC)
        </label>
        <input
          type="number"
          value={initUsdc}
          onChange={(e) => setInitUsdc(e.target.value)}
          className="w-full border rounded-lg px-4 py-3"
          required
        />
        <p className="text-xs text-gray-600 mt-1">
          Reserve auto-adjusts (2× USDC = {initReserve} tokens → 0.5 USDC/token)
        </p>
      </div>

      {/* Advanced */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-teal-600 text-sm font-medium"
        >
          {showAdvanced ? '▼ Hide Advanced Options' : '▶ Show Advanced Options'}
        </button>
      </div>

      {showAdvanced && (
        <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>YES Token Name</label>
              <input
                value={yesName}
                onChange={(e) => setYesName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label>YES Token Symbol</label>
              <input
                value={yesSymbol}
                onChange={(e) => setYesSymbol(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>NO Token Name</label>
              <input
                value={noName}
                onChange={(e) => setNoName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label>NO Token Symbol</label>
              <input
                value={noSymbol}
                onChange={(e) => setNoSymbol(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label>Initial Reserve (tokens)</label>
            <input
              type="number"
              value={initReserve}
              onChange={(e) => setInitReserve(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500">
              Auto-linked to liquidity (2× USDC = 0.5 USDC/token)
            </p>
          </div>
        </div>
      )}

      {/* Approve */}
      {needsApproval && (
        <div className="p-4 bg-red-50 border rounded-lg">
          <p className="text-red-800 font-semibold mb-2">
            Approval Required
          </p>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isApproving || isApprovalConfirming}
            className="w-full bg-red-600 hover:bg-red-500 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
          >
            {isApproving || isApprovalConfirming
              ? 'Approving...'
              : 'Approve USDC'}
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || isConfirming || needsApproval}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
      >
        {isPending || isConfirming ? 'Creating...' : 'Create Market'}
      </button>
    </form>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="max-w-4xl mx-auto px-4">
          <Link
            href="/"
            className="text-teal-600 hover:text-teal-500 font-medium mb-6 inline-block"
          >
            ← Back to Home
          </Link>
          <div className="bg-white p-8 rounded-xl shadow border">
            <h1 className="text-3xl font-bold mb-6">Create Market</h1>
            {formContent}
          </div>
        </div>
      </div>
    );
  }

  return <div className="bg-white p-6 rounded-lg shadow">{formContent}</div>;
}
