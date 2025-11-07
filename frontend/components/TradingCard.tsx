'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { coreAbi, usdcAbi, positionTokenAbi } from '@/lib/abis';

interface TradingCardProps {
  marketId: number;
  question: string;
}

export default function TradingCard({ marketId, question }: TradingCardProps) {
  const { address } = useAccount();
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [needsTokenApproval, setNeedsTokenApproval] = useState(false);
  const [yesBalance, setYesBalance] = useState('0');
  const [noBalance, setNoBalance] = useState('0');
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [estimatedOutput, setEstimatedOutput] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [calculatedSlippage, setCalculatedSlippage] = useState<number | null>(null);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [userModifiedSlippage, setUserModifiedSlippage] = useState(false);

  const [estimatedTokensE18, setEstimatedTokensE18] = useState<bigint | null>(null);
  const [estimatedUsdcE6, setEstimatedUsdcE6] = useState<bigint | null>(null);
  const [minTokensOutE18, setMinTokensOutE18] = useState<bigint | null>(null);
  const [minUsdcOutE6, setMinUsdcOutE6] = useState<bigint | null>(null);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: approvalHash, writeContract: writeApprove, isPending: isApproving } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });

  // --- Market Data ---
  const { data: marketData } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'markets',
    args: [BigInt(marketId)],
    query: { enabled: marketId > 0 },
  }) as any;

  const isObject = marketData && typeof marketData === 'object' && !Array.isArray(marketData);
  const yesTokenAddress = isObject ? marketData.yes : marketData?.[0];
  const noTokenAddress = isObject ? marketData.no : marketData?.[1];
  const reserveYes = isObject ? marketData.reserveYes : marketData?.[2];
  const reserveNo = isObject ? marketData.reserveNo : marketData?.[3];
  const virtualOffsetE18 = isObject ? marketData.virtualOffsetE18 : marketData?.[6];
  const feeTreasuryBps = Number(isObject ? marketData.feeTreasuryBps : marketData?.[7]) || 0;
  const feeVaultBps = Number(isObject ? marketData.feeVaultBps : marketData?.[8]) || 0;
  const feeLpBps = Number(isObject ? marketData.feeLpBps : marketData?.[9]) || 0;
  const totalFeeBps = feeTreasuryBps + feeVaultBps + feeLpBps;
  const sellFeesEnabled = Boolean(isObject ? marketData.sellFees : marketData?.[13]);

  // --- Prices ---
  const { data: priceYesE6 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceYesE6',
    args: [BigInt(marketId)],
    query: { enabled: marketId > 0 },
  });
  const { data: priceNoE6 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceNoE6',
    args: [BigInt(marketId)],
    query: { enabled: marketId > 0 },
  });

  // --- Balances ---
  const { data: usdcBal, refetch: refetchUsdcBalance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: isConfirming ? 2000 : false },
  });
  const { data: yesBal, refetch: refetchYesBalance } = useReadContract({
    address: yesTokenAddress,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!yesTokenAddress, refetchInterval: isConfirming ? 2000 : false },
  });
  const { data: noBal, refetch: refetchNoBalance } = useReadContract({
    address: noTokenAddress,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!noTokenAddress, refetchInterval: isConfirming ? 2000 : false },
  });

  useEffect(() => {
    if (usdcBal) setUsdcBalance(formatUnits(usdcBal as bigint, 6));
    if (yesBal) setYesBalance(formatUnits(yesBal as bigint, 18));
    if (noBal) setNoBalance(formatUnits(noBal as bigint, 18));
  }, [usdcBal, yesBal, noBal]);

  // --- Integer Square Root ---
  const sqrt = (x: bigint): bigint => {
    if (x === 0n) return 0n;
    let z = (x + 1n) / 2n;
    let y = x;
    while (z < y) {
      y = z;
      z = (x / z + z) / 2n;
    }
    return y;
  };

  // --- AMM Estimation ---
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !reserveYes || !reserveNo || !virtualOffsetE18 || !priceYesE6 || !priceNoE6) {
      setEstimatedOutput(null);
      setCalculatedSlippage(null);
      setPriceImpact(null);
      setEstimatedTokensE18(null);
      setEstimatedUsdcE6(null);
      setMinTokensOutE18(null);
      setMinUsdcOutE6(null);
      return;
    }

    try {
      const currentPriceYes = priceYesE6 as bigint;
      const currentPriceNo = priceNoE6 as bigint;

      if (tradeMode === 'buy') {
        const usdcIn = parseUnits(parseFloat(amount).toFixed(6), 6);
        const fee = (usdcIn * BigInt(totalFeeBps)) / 10000n;
        const netUsdc = usdcIn - fee;
        const amountE18 = netUsdc * 10n ** 12n;

        const v = virtualOffsetE18 as bigint;
        const boostedYesBefore = (reserveYes as bigint) + v;
        const boostedNoBefore = (reserveNo as bigint) + v;
        const x = boostedYesBefore + amountE18;
        const y = boostedNoBefore + amountE18;
        const k = x * y;
        const virtualAfter = v + amountE18;

        let tokensOutE18: bigint;
        if (side === 'yes') {
          const denom = y + amountE18;
          const newBoostedYes = k / denom;
          const yesFromSwap = x - newBoostedYes;
          tokensOutE18 = amountE18 + yesFromSwap;
        } else {
          const denom = x + amountE18;
          const newBoostedNo = k / denom;
          const noFromSwap = y - newBoostedNo;
          tokensOutE18 = amountE18 + noFromSwap;
        }

        const boostedYesAfter = side === 'yes'
          ? (reserveYes as bigint) + virtualAfter + (tokensOutE18 - amountE18)
          : (reserveYes as bigint) + virtualAfter;
        const boostedNoAfter = side === 'no'
          ? (reserveNo as bigint) + virtualAfter + (tokensOutE18 - amountE18)
          : (reserveNo as bigint) + virtualAfter;

        const newPriceYesE6 = (boostedNoAfter * 10n ** 6n) / (boostedYesAfter + boostedNoAfter);
        const newPriceE6 = side === 'yes' ? newPriceYesE6 : 1_000_000n - newPriceYesE6;

        const priceImpactBps = Math.abs(Number((newPriceE6 - currentPriceYes) * 10000n / currentPriceYes));
        const priceImpactPercent = priceImpactBps / 100;
        const recommendedSlippage = Math.max(0.1, Math.min(10, priceImpactPercent + 0.3));

        setPriceImpact(priceImpactPercent);
        setCalculatedSlippage(recommendedSlippage);
        setEstimatedTokensE18(tokensOutE18);
        setEstimatedUsdcE6(null);

        const effectiveSlippage = Math.max(slippage, recommendedSlippage);
        const slippageBps = BigInt(Math.round(effectiveSlippage * 100));
        const minOut = (tokensOutE18 * (10000n - slippageBps)) / 10000n;
        setMinTokensOutE18(minOut);
        setMinUsdcOutE6(null);

        setEstimatedOutput(`≈ ${parseFloat(formatUnits(tokensOutE18, 18)).toFixed(4)} ${side.toUpperCase()}`);
      } else {
        // SELL: QUADRATIC INVERSE
        const tokensIn = parseUnits(parseFloat(amount).toFixed(18), 18);
        const t = tokensIn;
        const v = virtualOffsetE18 as bigint;
        const by = (reserveYes as bigint) + v;
        const bn = (reserveNo as bigint) + v;
        const boostedSame = side === 'yes' ? by : bn;
        const boostedOpposite = side === 'yes' ? bn : by;

        const S = boostedSame + boostedOpposite + t;
        if (S > 2n ** 128n - 1n) throw new Error('Trade too large');

        const S2 = S * S;
        const fourTOpp = 4n * t * boostedOpposite;
        if (S2 <= fourTOpp) throw new Error('Invalid discriminant');

        const disc = S2 - fourTOpp;
        const sqrtDisc = sqrt(disc);
        if (S < sqrtDisc) throw new Error('Math error');

        const a = (S - sqrtDisc) / 2n;
        if (a === 0n || a > v) throw new Error('No liquidity');

        let usdcOutE6 = a / 10n ** 12n;
        if (sellFeesEnabled && totalFeeBps > 0) {
          const fee = (usdcOutE6 * BigInt(totalFeeBps)) / 10000n;
          usdcOutE6 -= fee;
        }

        // Reconstruct new price
        const boostedOppositeBefore = boostedOpposite - 2n * a;
        const denom = boostedOppositeBefore + a;
        if (denom === 0n) throw new Error('Division by zero');
        const boostedSameBefore = (boostedSame * boostedOpposite) / denom - a;
        const newV = v - a;

        const newBoostedYes = side === 'yes' ? boostedSameBefore - newV : boostedOppositeBefore - newV;
        const newBoostedNo = side === 'yes' ? boostedOppositeBefore - newV : boostedSameBefore - newV;

        const newPriceYesE6 = (newBoostedNo * 10n ** 6n) / (newBoostedYes + newBoostedNo);
        const newPriceE6 = side === 'yes' ? newPriceYesE6 : 1_000_000n - newPriceYesE6;

        const priceImpactBps = Math.abs(Number((newPriceE6 - currentPriceYes) * 10000n / currentPriceYes));
        const priceImpactPercent = priceImpactBps / 100;
        const recommendedSlippage = Math.max(0.1, Math.min(10, priceImpactPercent + 0.3));

        setPriceImpact(priceImpactPercent);
        setCalculatedSlippage(recommendedSlippage);
        setEstimatedUsdcE6(usdcOutE6);
        setEstimatedTokensE18(null);

        const effectiveSlippage = Math.max(slippage, recommendedSlippage);
        const slippageBps = BigInt(Math.round(effectiveSlippage * 100));
        const minOut = (usdcOutE6 * (10000n - slippageBps)) / 10000n;
        setMinUsdcOutE6(minOut);
        setMinTokensOutE18(null);

        setEstimatedOutput(`≈ $${parseFloat(formatUnits(usdcOutE6, 6)).toFixed(2)} USDC`);
      }
    } catch (err) {
      console.error('AMM calc error:', err);
      setEstimatedOutput('Invalid trade');
      setCalculatedSlippage(null);
      setPriceImpact(null);
    }
  }, [amount, tradeMode, side, marketData, priceYesE6, priceNoE6, reserveYes, reserveNo, virtualOffsetE18]);

  // Auto-slippage
  useEffect(() => {
    if (calculatedSlippage && !userModifiedSlippage && amount) {
      setSlippage(calculatedSlippage);
    }
  }, [calculatedSlippage, amount, userModifiedSlippage]);

  const handleManualSlippage = (v: number) => {
    setSlippage(v);
    setUserModifiedSlippage(true);
  };

  // --- Approval Logic ---
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: { enabled: tradeMode === 'buy' && !!address },
  });

  const tokenAddr = tradeMode === 'sell' ? (side === 'yes' ? yesTokenAddress : noTokenAddress) : undefined;
  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({
    address: tokenAddr,
    abi: positionTokenAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: { enabled: tradeMode === 'sell' && !!tokenAddr },
  });

  useEffect(() => {
    if (tradeMode === 'buy' && amount && usdcAllowance) {
      const required = parseUnits(amount, 6);
      setNeedsApproval((usdcAllowance as bigint) < required);
    }
    if (tradeMode === 'sell' && amount && tokenAllowance && tokenAddr) {
      const required = parseUnits(amount, 18);
      setNeedsTokenApproval((tokenAllowance as bigint) < required);
    }
  }, [amount, usdcAllowance, tokenAllowance, tradeMode, tokenAddr]);

  const [pendingTrade, setPendingTrade] = useState(false);
  useEffect(() => {
    if (!isApprovalSuccess) return;

    if (tradeMode === 'buy') {
      refetchUsdcAllowance?.();
      setNeedsApproval(false);
    } else if (tradeMode === 'sell') {
      refetchTokenAllowance?.();
      setNeedsTokenApproval(false);
    }

    if (pendingTrade) {
      setPendingTrade(false);
      setTimeout(() => handleTrade(), 300);
    }
  }, [isApprovalSuccess, tradeMode, pendingTrade, refetchUsdcAllowance, refetchTokenAllowance]);

  // --- Trade ---
  const handleTrade = async () => {
    if (!amount) return;

    if (tradeMode === 'buy' && needsApproval) {
      setPendingTrade(true);
      writeApprove({
        address: addresses.usdc,
        abi: usdcAbi,
        functionName: 'approve',
        args: [addresses.core, parseUnits(amount, 6) * 1000n],
      });
      return;
    }
    if (tradeMode === 'sell' && needsTokenApproval) {
      setPendingTrade(true);
      writeApprove({
        address: tokenAddr!,
        abi: positionTokenAbi,
        functionName: 'approve',
        args: [addresses.core, parseUnits(amount, 18) * 1000n],
      });
      return;
    }

    if (tradeMode === 'buy') {
      const minOut = minTokensOutE18 || 0n;
      writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: side === 'yes' ? 'buyYes' : 'buyNo',
        args: [BigInt(marketId), parseUnits(amount, 6), minOut],
      });
    } else {
      const minOut = minUsdcOutE6 || 0n;
      writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: side === 'yes' ? 'sellYes' : 'sellNo',
        args: [BigInt(marketId), parseUnits(amount, 18), minOut],
      });
    }
  };

  // --- UI ---
  const priceYes = priceYesE6 ? parseFloat(formatUnits(priceYesE6 as bigint, 6)) : 0;
  const priceNo = priceNoE6 ? parseFloat(formatUnits(priceNoE6 as bigint, 6)) : 0;
  const formatPrice = (p: number) => p >= 1 ? `$${p.toFixed(2)}` : `${(p * 100).toFixed(1)}¢`;

  const totalCost = amount && parseFloat(amount) > 0
    ? tradeMode === 'buy' ? parseFloat(amount) : parseFloat(amount) * (side === 'yes' ? priceYes : priceNo)
    : 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {(['buy', 'sell'] as const).map(m => (
          <button key={m} onClick={() => setTradeMode(m)}
            className={`flex-1 rounded-lg py-2.5 font-bold transition-all ${tradeMode === m ? 'bg-green-500 text-white' : 'text-gray-600'}`}>
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* YES/NO Cards */}
      <div className="grid grid-cols-2 gap-3">
        {(['yes', 'no'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)}
            className={`p-4 rounded-xl text-left transition-all ${side === s ? 'ring-2 ring-green-500' : ''} ${s === 'yes' ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="text-2xl font-black">{formatPrice(s === 'yes' ? priceYes : priceNo)}</div>
            <div className="text-xs font-bold uppercase text-gray-600">{s}</div>
          </button>
        ))}
      </div>

      {/* Amount */}
      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.0"
        className="w-full rounded-lg border px-4 py-3 text-lg font-semibold text-center focus:ring-2 focus:ring-green-500" />

      {/* Quick Buttons */}
      <div className="flex gap-2">
        {['10', '50', '100', 'Max'].map(q => (
          <button key={q} onClick={() => setAmount(q === 'Max' ? (tradeMode === 'buy' ? usdcBalance : side === 'yes' ? yesBalance : noBalance) : q)}
            className="flex-1 bg-green-50 hover:bg-green-100 py-2 rounded-lg font-bold text-green-700">
            {q}
          </button>
        ))}
      </div>

      {/* Preview */}
      {estimatedOutput && (
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-sm text-gray-600">You receive</div>
          <div className="text-2xl font-black">{estimatedOutput}</div>
        </div>
      )}

      {/* Slippage */}
      <button onClick={() => setShowSlippageSettings(!showSlippageSettings)}
        className="w-full text-left py-3 border-t flex justify-between items-center">
        <span>Slippage: {slippage}% {calculatedSlippage && `(Auto: ${calculatedSlippage.toFixed(2)}%)`}</span>
        <span>▼</span>
      </button>
      {showSlippageSettings && (
        <div className="space-y-2">
          {[0.1, 0.5, 1, 5].map(p => (
            <button key={p} onClick={() => handleManualSlippage(p)}
              className={`w-full py-2 rounded-lg font-bold ${slippage === p ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>
              {p}%
            </button>
          ))}
          <input type="number" value={slippage} onChange={e => handleManualSlippage(parseFloat(e.target.value) || 0.5)}
            className="w-full rounded-lg border px-3 py-2" step="0.1" />
        </div>
      )}

      {/* Trade Button */}
      <button onClick={handleTrade}
        disabled={isPending || isConfirming || isApproving || !amount || parseFloat(amount) <= 0}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg disabled:opacity-50">
        {isPending || isConfirming ? 'Processing...' : needsApproval || needsTokenApproval ? 'Approve & Trade' : tradeMode.toUpperCase()}
      </button>
    </div>
  );
}