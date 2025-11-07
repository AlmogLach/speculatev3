'use client';
import { useState, useEffect, ChangeEvent, useMemo, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { coreAbi, usdcAbi, positionTokenAbi } from '@/lib/abis';

const SCALE = 10n ** 18n;
const USDC_TO_E18 = 10n ** 12n;
const LN2 = 693147180559945309n;
const LOG2_E = 1442695040888963407n;
const TWO_OVER_LN2 = (2n * SCALE * SCALE) / LN2;
const MAX_SEARCH_ITERATIONS = 60;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function formatBalanceDisplay(value: bigint, decimals: number, places = 3): string {
  const num = Number(formatUnits(value, decimals));
  if (!Number.isFinite(num)) return '0';
  return num.toFixed(places);
}

function mul(x: bigint, y: bigint): bigint {
  return (x * y) / SCALE;
}

function div(x: bigint, y: bigint): bigint {
  if (y === 0n) return 0n;
  return (x * SCALE) / y;
}

function exp2(x: bigint): bigint {
  if (x < 0n) {
    const positive = exp2(-x);
    if (positive === 0n) return 0n;
    return (SCALE * SCALE) / positive;
  }

  if (x > 192n * SCALE) {
    x = 192n * SCALE;
  }

  const intPart = x / SCALE;
  const frac = x % SCALE;
  let res = SCALE;
  let term = SCALE;
  const y = mul(frac, LN2);

  for (let i = 1n; i <= 20n; i++) {
    term = (term * y) / SCALE / i;
    res += term;
    if (term === 0n) break;
  }

  const pow = 1n << intPart;
  return pow * res;
}

function log2(x: bigint): bigint {
  if (x <= 0n) {
    throw new Error('log2 undefined');
  }

  let res = 0n;
  let value = x;

  const shiftChecks: Array<[bigint, bigint]> = [
    [128n, 128n * SCALE],
    [64n, 64n * SCALE],
    [32n, 32n * SCALE],
    [16n, 16n * SCALE],
    [8n, 8n * SCALE],
    [4n, 4n * SCALE],
    [2n, 2n * SCALE],
    [1n, SCALE],
  ];

  for (const [shift, add] of shiftChecks) {
    if (value >= (SCALE << shift)) {
      value >>= shift;
      res += add;
    }
  }

  const numerator = value - SCALE;
  const denominator = value + SCALE;
  const z = denominator === 0n ? 0n : div(numerator, denominator);
  const z2 = mul(z, z);
  let w = SCALE;
  w += mul(z2, SCALE) / 3n;
  const z4 = mul(z2, z2);
  w += mul(z4, SCALE) / 5n;
  const z6 = mul(z4, z2);
  w += mul(z6, SCALE) / 7n;
  const z8 = mul(z6, z2);
  w += mul(z8, SCALE) / 9n;
  return res + mul(mul(z, w), TWO_OVER_LN2);
}

function ln(x: bigint): bigint {
  return mul(log2(x), LN2);
}

function costFunction(qYes: bigint, qNo: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('invalid liquidity');
  const expYes = exp2(mul(div(qYes, b), LOG2_E));
  const expNo = exp2(mul(div(qNo, b), LOG2_E));
  return mul(b, ln(expYes + expNo));
}

function spotPriceYesE18(qYes: bigint, qNo: bigint, b: bigint): bigint {
  if (b === 0n) return SCALE / 2n;
  const expYes = exp2(mul(div(qYes, b), LOG2_E));
  const expNo = exp2(mul(div(qNo, b), LOG2_E));
  const denominator = expYes + expNo;
  if (denominator === 0n) return 0n;
  return div(expYes, denominator);
}

function findSharesOut(qSide: bigint, qOther: bigint, netE18: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('invalid liquidity');
  let lo = 0n;
  let hi = b * 100n;
  if (hi === 0n) hi = 1n * SCALE;
  const baseCost = costFunction(qSide, qOther, b);

  for (let i = 0; i < MAX_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2n;
    const newCost = costFunction(qSide + mid, qOther, b);
    const delta = newCost - baseCost;
    if (delta <= netE18) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2n;
}

interface TradingCardProps {
  marketId: number;
  question: string;
}

export default function TradingCard({ marketId }: TradingCardProps) {
  const { address } = useAccount();
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState('');
  const [yesBalance, setYesBalance] = useState('0');
  const [noBalance, setNoBalance] = useState('0');
  const [usdcBalance, setUsdcBalance] = useState('0');

  const [currentPrice, setCurrentPrice] = useState(0);
  const [newPrice, setNewPrice] = useState(0);
  const [shares, setShares] = useState(0);
  const [avgPrice, setAvgPrice] = useState(0);
  const [costUsd, setCostUsd] = useState(0);
  const [feeUsd, setFeeUsd] = useState(0);
  const [feePercent, setFeePercent] = useState(0);
  const [maxProfit, setMaxProfit] = useState(0);
  const [maxProfitPct, setMaxProfitPct] = useState(0);
  const [maxPayout, setMaxPayout] = useState(0);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: approvalHash, writeContract: writeApprove, isPending: isApproving } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });

  const [pendingTrade, setPendingTrade] = useState(false);

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
  const qYes = BigInt(isObject ? marketData.qYes ?? 0n : marketData?.[2] ?? 0n);
  const qNo = BigInt(isObject ? marketData.qNo ?? 0n : marketData?.[3] ?? 0n);
  const bE18 = BigInt(isObject ? marketData.bE18 ?? 0n : marketData?.[6] ?? 0n);
  const feeTreasuryBps = Number(isObject ? marketData.feeTreasuryBps : marketData?.[7]) || 0;
  const feeVaultBps = Number(isObject ? marketData.feeVaultBps : marketData?.[8]) || 0;
  const feeLpBps = Number(isObject ? marketData.feeLpBps : marketData?.[9]) || 0;
  const totalFeeBps = feeTreasuryBps + feeVaultBps + feeLpBps;

  const { data: priceYesE18 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceYesE18',
    args: [BigInt(marketId)],
  });

  const { data: usdcBal } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: yesBal } = useReadContract({
    address: yesTokenAddress,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!yesTokenAddress },
  });

  const { data: noBal } = useReadContract({
    address: noTokenAddress,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!noTokenAddress },
  });

  useEffect(() => {
    if (usdcBal) setUsdcBalance(formatBalanceDisplay(usdcBal as bigint, 6));
    if (yesBal) setYesBalance(formatBalanceDisplay(yesBal as bigint, 18));
    if (noBal) setNoBalance(formatBalanceDisplay(noBal as bigint, 18));
  }, [usdcBal, yesBal, noBal]);

  const { data: usdcAllowance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: { enabled: tradeMode === 'buy' && !!address && !!amount },
  });

  const tokenAddr = tradeMode === 'sell' ? (side === 'yes' ? yesTokenAddress : noTokenAddress) : undefined;
  const { data: tokenAllowance } = useReadContract({
    address: tokenAddr,
    abi: positionTokenAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: { enabled: tradeMode === 'sell' && !!tokenAddr && !!address && !!amount },
  });

  const usdcAllowanceValue = usdcAllowance as bigint | undefined;
  const tokenAllowanceValue = tokenAllowance as bigint | undefined;

  const needsUsdcApproval =
    tradeMode === 'buy' &&
    !!amount &&
    usdcAllowanceValue !== undefined &&
    parseUnits(amount, 6) > usdcAllowanceValue;

  const needsTokenApproval =
    tradeMode === 'sell' &&
    !!amount &&
    tokenAllowanceValue !== undefined &&
    parseUnits(amount, 18) > tokenAllowanceValue;

  const needsApproval = needsUsdcApproval || needsTokenApproval;

  const vaultBase = useMemo(() => {
    const raw = BigInt(isObject ? marketData.usdcVault ?? 0n : marketData?.[4] ?? 0n);
    return parseFloat(formatUnits(raw, 6));
  }, [isObject, marketData]);

  const yesBase = useMemo(() => parseFloat(formatUnits(qYes, 18)), [qYes]);
  const noBase = useMemo(() => parseFloat(formatUnits(qNo, 18)), [qNo]);
  const depthBase = useMemo(() => parseFloat(formatUnits(bE18, 18)), [bE18]);

  const baseSpotYes = useMemo(() => {
    if (priceYesE18) {
      return parseFloat(formatUnits(priceYesE18 as bigint, 18));
    }
    if (bE18 === 0n) return 0;
    try {
      const price = spotPriceYesE18(qYes, qNo, bE18);
      return parseFloat(formatUnits(price, 18));
    } catch {
      return 0;
    }
  }, [priceYesE18, qYes, qNo, bE18]);

  const [vaultAfter, setVaultAfter] = useState(vaultBase);
  const [vaultDelta, setVaultDelta] = useState(0);
  const [yesAfter, setYesAfter] = useState(yesBase);
  const [noAfter, setNoAfter] = useState(noBase);

  useEffect(() => {
    setVaultAfter(vaultBase);
    setVaultDelta(0);
    setYesAfter(yesBase);
    setNoAfter(noBase);
  }, [vaultBase, yesBase, noBase]);

  const resetPreview = useCallback(() => {
    const current = side === 'yes' ? clamp(baseSpotYes, 0, 1) : clamp(1 - baseSpotYes, 0, 1);
    setCurrentPrice(current);
    setNewPrice(current);
    setShares(0);
    setAvgPrice(0);
    setCostUsd(0);
    setFeeUsd(0);
    setFeePercent(tradeMode === 'buy' ? totalFeeBps / 100 : 0);
    setMaxProfit(0);
    setMaxProfitPct(0);
    setMaxPayout(0);
    setVaultAfter(vaultBase);
    setVaultDelta(0);
    setYesAfter(yesBase);
    setNoAfter(noBase);
  }, [baseSpotYes, side, tradeMode, totalFeeBps, vaultBase, yesBase, noBase]);

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || bE18 === 0n) {
      resetPreview();
      return;
    }

    try {
      if (tradeMode === 'buy') {
        const usdcIn = parseUnits(amount, 6);
        if (usdcIn <= 0n) {
          resetPreview();
          return;
        }

        const feeT = usdcIn * BigInt(feeTreasuryBps) / 10_000n;
        const feeV = usdcIn * BigInt(feeVaultBps) / 10_000n;
        const feeL = usdcIn * BigInt(feeLpBps) / 10_000n;
        const net = usdcIn - feeT - feeV - feeL;
        if (net <= 0n) {
          resetPreview();
          return;
        }

        const netE18 = net * USDC_TO_E18;
        const baseSide = side === 'yes' ? qYes : qNo;
        const baseOther = side === 'yes' ? qNo : qYes;
        const tokensOut = findSharesOut(baseSide, baseOther, netE18, bE18);
        if (tokensOut <= 0n) {
          resetPreview();
          return;
        }

        const avgPriceE6 = (usdcIn * 1_000_000n) / (tokensOut / 1_000_000_000_000n);
        const newQYes = side === 'yes' ? qYes + tokensOut : qYes;
        const newQNo = side === 'no' ? qNo + tokensOut : qNo;
        const newPriceYes = parseFloat(formatUnits(spotPriceYesE18(newQYes, newQNo, bE18), 18));

        const sharesNum = parseFloat(formatUnits(tokensOut, 18));
        const grossUsd = parseFloat(formatUnits(usdcIn, 6));
        const feeUsdValue = parseFloat(formatUnits(feeT + feeV + feeL, 6));
        const maxPayoutValue = sharesNum;
        const profit = maxPayoutValue - grossUsd;
        const profitPct = grossUsd > 0 ? (profit / grossUsd) * 100 : 0;

        const vaultIncrease = Number(formatUnits(net + feeV, 6));
        setCurrentPrice(side === 'yes' ? clamp(baseSpotYes, 0, 1) : clamp(1 - baseSpotYes, 0, 1));
        setNewPrice(side === 'yes' ? clamp(newPriceYes, 0, 1) : clamp(1 - newPriceYes, 0, 1));
        setShares(sharesNum);
        setAvgPrice(Number(avgPriceE6) / 1e6);
        setCostUsd(grossUsd);
        setFeeUsd(feeUsdValue);
        setFeePercent(totalFeeBps / 100);
        setMaxProfit(profit);
        setMaxProfitPct(profitPct);
        setMaxPayout(maxPayoutValue);
        setVaultAfter(vaultBase + vaultIncrease);
        setVaultDelta(vaultIncrease);
        const yesAfterVal = side === 'yes' ? yesBase + sharesNum : yesBase;
        const noAfterVal = side === 'no' ? noBase + sharesNum : noBase;
        setYesAfter(yesAfterVal);
        setNoAfter(noAfterVal);
      } else {
        const tokensIn = parseUnits(amount, 18);
        if (tokensIn <= 0n) {
          resetPreview();
          return;
        }

        if ((side === 'yes' && tokensIn > qYes) || (side === 'no' && tokensIn > qNo)) {
          resetPreview();
          return;
        }

        const oldCost = costFunction(qYes, qNo, bE18);
        const newQYes = side === 'yes' ? qYes - tokensIn : qYes;
        const newQNo = side === 'no' ? qNo - tokensIn : qNo;
        const newCost = costFunction(newQYes, newQNo, bE18);
        const refundE18 = oldCost - newCost;
        if (refundE18 <= 0n) {
          resetPreview();
          return;
        }

        const usdcOut = refundE18 / USDC_TO_E18;
        const avgPriceE6 = (usdcOut * 1_000_000_000_000n) / tokensIn;
        const newPriceYes = parseFloat(formatUnits(spotPriceYesE18(newQYes, newQNo, bE18), 18));

        const sharesNum = parseFloat(formatUnits(tokensIn, 18));
        const payout = parseFloat(formatUnits(usdcOut, 6));

        const vaultDecrease = Number(formatUnits(usdcOut, 6));
        setCurrentPrice(side === 'yes' ? clamp(baseSpotYes, 0, 1) : clamp(1 - baseSpotYes, 0, 1));
        setNewPrice(side === 'yes' ? clamp(newPriceYes, 0, 1) : clamp(1 - newPriceYes, 0, 1));
        setShares(sharesNum);
        setAvgPrice(Number(avgPriceE6) / 1e6);
        setCostUsd(payout);
        setFeeUsd(0);
        setFeePercent(0);
        setMaxProfit(payout);
        setMaxProfitPct(0);
        setMaxPayout(payout);
        setVaultAfter(vaultBase - vaultDecrease);
        setVaultDelta(-vaultDecrease);
        const yesAfterVal = side === 'yes' ? yesBase - sharesNum : yesBase;
        const noAfterVal = side === 'no' ? noBase - sharesNum : noBase;
        setYesAfter(yesAfterVal);
        setNoAfter(noAfterVal);
      }
    } catch (error) {
      console.error('Failed to compute trade preview', error);
      resetPreview();
    }
  }, [amount, tradeMode, side, qYes, qNo, bE18, feeTreasuryBps, feeVaultBps, feeLpBps, baseSpotYes, totalFeeBps, resetPreview, vaultBase, yesBase, noBase]);

  const handleTrade = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) return;

    if (needsUsdcApproval) {
      setPendingTrade(true);
      writeApprove({
        address: addresses.usdc,
        abi: usdcAbi,
        functionName: 'approve',
        args: [addresses.core, parseUnits(amount, 6) * 1000n],
      });
      return;
    }

    if (needsTokenApproval && tokenAddr) {
      setPendingTrade(true);
      writeApprove({
        address: tokenAddr,
        abi: positionTokenAbi,
        functionName: 'approve',
        args: [addresses.core, parseUnits(amount, 18) * 1000n],
      });
      return;
    }

    const fn = tradeMode === 'buy'
      ? side === 'yes' ? 'buyYes' : 'buyNo'
      : side === 'yes' ? 'sellYes' : 'sellNo';

    const amountParsed = parseUnits(amount, tradeMode === 'buy' ? 6 : 18);

    writeContract({
      address: addresses.core,
      abi: coreAbi,
      functionName: fn,
      args: [BigInt(marketId), amountParsed, 0n],
    });
  }, [amount, marketId, needsUsdcApproval, needsTokenApproval, tradeMode, side, tokenAddr, writeContract, writeApprove]);

  useEffect(() => {
    if (isApprovalSuccess && pendingTrade) {
      setPendingTrade(false);
      setTimeout(() => handleTrade(), 1000);
    }
  }, [isApprovalSuccess, pendingTrade, handleTrade]);

  const priceYes = clamp(baseSpotYes, 0, 1);
  const priceNo = Math.max(0, 1 - priceYes);

  const yesChange = yesAfter - yesBase;
  const noChange = noAfter - noBase;
  const depthDisplay = depthBase;

  const formatPrice = (p: number) => p >= 1 ? `$${p.toFixed(2)}` : `${(p * 100).toFixed(1)}¢`;

  const maxBuyAmount = parseFloat(usdcBalance);
  const maxSellAmount = side === 'yes' ? parseFloat(yesBalance) : parseFloat(noBalance);
  const inputAmount = parseFloat(amount) || 0;

  const canBuy = tradeMode === 'buy' && inputAmount > 0 && inputAmount <= maxBuyAmount;
  const canSell = tradeMode === 'sell' && inputAmount > 0 && inputAmount <= maxSellAmount;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        {(['buy', 'sell'] as const).map(m => (
          <button
            key={m}
            onClick={() => setTradeMode(m)}
            className={`flex-1 rounded-lg py-2.5 font-bold transition-all ${tradeMode === m ? 'bg-green-500 text-white' : 'text-gray-600'}`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(['yes', 'no'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`p-4 rounded-xl text-left transition-all ${side === s ? 'ring-2 ring-green-500' : ''} ${s === 'yes' ? 'bg-green-50' : 'bg-red-50'}`}
          >
            <div className="text-2xl font-black">{formatPrice(s === 'yes' ? priceYes : priceNo)}</div>
            <div className="text-xs font-bold uppercase text-gray-600">{s}</div>
            <div className="text-xs text-gray-500 mt-1">
              You have: {s === 'yes' ? yesBalance : noBalance}
            </div>
          </button>
        ))}
      </div>

      <div className="text-center text-sm text-gray-600">
        {tradeMode === 'buy' ? `USDC Balance: ${usdcBalance}` : `${side.toUpperCase()} Balance: ${side === 'yes' ? yesBalance : noBalance}`}
      </div>

      <input
        type="number"
        value={amount}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const val = e.target.value;
          const num = parseFloat(val) || 0;
          if (tradeMode === 'buy' && num > maxBuyAmount) return;
          if (tradeMode === 'sell' && num > maxSellAmount) return;
          setAmount(val);
        }}
        placeholder="0.0"
        className="w-full rounded-lg border px-4 py-3 text-lg font-semibold text-center focus:ring-2 focus:ring-green-500"
      />

      <div className="flex gap-2">
        {['10', '50', '100', 'Max'].map(q => (
          <button
            key={q}
            onClick={() => {
              const max = tradeMode === 'buy' ? maxBuyAmount : maxSellAmount;
              setAmount(q === 'Max' ? max.toString() : q);
            }}
            className="flex-1 bg-green-50 hover:bg-green-100 py-2 rounded-lg font-bold text-green-700"
          >
            {q}
          </button>
        ))}
      </div>

      {amount && parseFloat(amount) > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Current price</span>
            <span className="font-bold">${currentPrice.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">New price</span>
            <span className="font-bold">${newPrice.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shares</span>
            <span className="font-bold">{shares.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Avg. price</span>
            <span className="font-bold">${avgPrice.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fee</span>
            <span className="font-bold">{feePercent.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-green-600 font-bold text-sm">
            <span className="text-gray-600">Max profit</span>
            <span>${maxProfit.toFixed(2)} (+{maxProfitPct.toFixed(1)}%)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Max payout</span>
            <span className="font-bold">${maxPayout.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleTrade}
        disabled={
          isPending || isConfirming || isApproving || isApprovalConfirming ||
          !amount || parseFloat(amount) <= 0 ||
          (tradeMode === 'buy' && !canBuy) ||
          (tradeMode === 'sell' && !canSell)
        }
        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isApproving || isApprovalConfirming ? 'Approving…' :
         isPending || isConfirming ? 'Processing…' :
         needsApproval ? 'Approve & Trade' :
         tradeMode.toUpperCase()}
      </button>
    </div>
  );
}