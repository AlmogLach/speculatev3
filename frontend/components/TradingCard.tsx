'use client';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { addresses } from '@/lib/contracts';
import { coreAbi, usdcAbi, positionTokenAbi } from '@/lib/abis';

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

  // Real stats
  const [currentPrice, setCurrentPrice] = useState(0);
  const [newPrice, setNewPrice] = useState(0);
  const [shares, setShares] = useState(0);
  const [avgPrice, setAvgPrice] = useState(0);
  const [feePercent, setFeePercent] = useState(0);
  const [maxProfit, setMaxProfit] = useState(0);
  const [maxProfitPct, setMaxProfitPct] = useState(0);
  const [maxPayout, setMaxPayout] = useState(0);

  const [estimatedTokensE18, setEstimatedTokensE18] = useState<bigint | null>(null);
  const [estimatedUsdcE6, setEstimatedUsdcE6] = useState<bigint | null>(null);
  const [minTokensOutE18, setMinTokensOutE18] = useState<bigint | null>(null);
  const [minUsdcOutE6, setMinUsdcOutE6] = useState<bigint | null>(null);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const { data: approvalHash, writeContract: writeApprove, isPending: isApproving } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });

  const [pendingTrade, setPendingTrade] = useState(false);

  // Market Data
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
  const totalFeeBps = (Number(isObject ? marketData.feeTreasuryBps : marketData?.[7]) || 0) +
                     (Number(isObject ? marketData.feeVaultBps : marketData?.[8]) || 0) +
                     (Number(isObject ? marketData.feeLpBps : marketData?.[9]) || 0);
  const sellFeesEnabled = Boolean(isObject ? marketData.sellFees : marketData?.[13]);

  // Prices
  const { data: priceYesE6 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceYesE6',
    args: [BigInt(marketId)],
    query: { enabled: marketId > 0 },
  });
  const { data: isPriceNoE6 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceNoE6',
    args: [BigInt(marketId)],
    query: { enabled: marketId > 0 },
  });

  // Balances
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
    query: { enabled: !!yesTokenAddress },
  });
  const { data: noBal } = useReadContract({
    address: noTokenAddress,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!noTokenAddress },
  });

  useEffect(() => {
    if (usdcBal) setUsdcBalance(formatUnits(usdcBal as bigint, 6));
    if (yesBal) setYesBalance(formatUnits(yesBal as bigint, 18));
    if (noBal) setNoBalance(formatUnits(noBal as bigint, 18));
  }, [usdcBal, yesBal, noBal]);

  // Approvals
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
    query: { enabled: tradeMode === 'sell' && !!tokenAddr && !!amount },
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

  // Auto-trade after approval
  useEffect(() => {
    if (isApprovalSuccess && pendingTrade) {
      setPendingTrade(false);
      setTimeout(() => handleTrade(), 1000);
    }
  }, [isApprovalSuccess, pendingTrade]);

  // Integer sqrt
  const sqrt = (x: bigint): bigint => {
    if (x === 0n) return 0n;
    let z = (x + 1n) / 2n;
    let y = x;
    while (z < y) { y = z; z = (x / z + z) / 2n; }
    return y;
  };

  // REAL STATS + AMM + BALANCE CHECKS
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !priceYesE6 || !reserveYes || !reserveNo || !virtualOffsetE18) {
      setCurrentPrice(0); setNewPrice(0); setShares(0); setAvgPrice(0); setFeePercent(0);
      setMaxProfit(0); setMaxProfitPct(0); setMaxPayout(0);
      return;
    }

    const priceYes = parseFloat(formatUnits(priceYesE6 as bigint, 6));
    const currPrice = side === 'yes' ? priceYes : 1 - priceYes;
    setCurrentPrice(currPrice);

    try {
      if (tradeMode === 'buy') {
        const usdcIn = parseUnits(parseFloat(amount).toFixed(6), 6);
        const fee = (usdcIn * BigInt(totalFeeBps)) / 10000n;
        const net = usdcIn - fee;
        const amountE18 = net * 10n ** 12n;

        const v = virtualOffsetE18 as bigint;
        const by = (reserveYes as bigint) + v;
        const bn = (reserveNo as bigint) + v;

        const k = (by + amountE18) * (bn + amountE18);
        let tokensOutE18: bigint;

        if (side === 'yes') {
          const denom = bn + amountE18 + amountE18;
          const newX = k / denom;
          tokensOutE18 = amountE18 + (by + amountE18 - newX);
        } else {
          const denom = by + amountE18 + amountE18;
          const newY = k / denom;
          tokensOutE18 = amountE18 + (bn + amountE18 - newY);
        }

        const sharesNum = parseFloat(formatUnits(tokensOutE18, 18));
        const cost = parseFloat(amount);
        const avg = cost / sharesNum;
        const profit = sharesNum - cost;
        const profitPct = (profit / cost) * 100;

        const boostedYesAfter = side === 'yes' ? by + amountE18 + (tokensOutE18 - amountE18) : by + amountE18;
        const boostedNoAfter = side === 'no' ? bn + amountE18 + (tokensOutE18 - amountE18) : bn + amountE18;
        const newPriceYes = parseFloat(formatUnits((boostedNoAfter * 10n ** 6n) / (boostedYesAfter + boostedNoAfter), 6));
        const newP = side === 'yes' ? newPriceYes : 1 - newPriceYes;

        setShares(sharesNum);
        setAvgPrice(avg);
        setFeePercent(totalFeeBps / 100);
        setMaxProfit(profit);
        setMaxProfitPct(profitPct);
        setMaxPayout(sharesNum);
        setNewPrice(newP);

        setEstimatedTokensE18(tokensOutE18);
        const minOut = (tokensOutE18 * 9950n) / 10000n;
        setMinTokensOutE18(minOut);
      } else {
        if ((virtualOffsetE18 as bigint) === 0n) return;

        const tokensIn = parseUnits(parseFloat(amount).toFixed(18), 18);
        const v = virtualOffsetE18 as bigint;
        const by = (reserveYes as bigint) + v;
        const bn = (reserveNo as bigint) + v;
        const same = side === 'yes' ? by : bn;
        const opp = side === 'yes' ? bn : by;

        const S = same + opp + tokensIn;
        const disc = S * S - 4n * tokensIn * opp;
        const a = (S - sqrt(disc)) / 2n;

        let usdcOut = a / 10n ** 12n;
        if (sellFeesEnabled) {
          const fee = (usdcOut * BigInt(totalFeeBps)) / 10000n;
          usdcOut -= fee;
        }

        const usdcNum = parseFloat(formatUnits(usdcOut, 6));
        const avgSell = usdcNum / parseFloat(amount);

        setShares(parseFloat(amount));
        setAvgPrice(avgSell);
        setFeePercent(sellFeesEnabled ? totalFeeBps / 100 : 0);
        setMaxProfit(usdcNum);
        setMaxProfitPct(0);
        setMaxPayout(usdcNum);

        const newV = v - a;
        const oppBefore = opp - 2n * a;
        const sameBefore = (same * opp) / (oppBefore + a) - a;
        const newYes = side === 'yes' ? sameBefore - newV : oppBefore - newV;
        const newNo = side === 'yes' ? oppBefore - newV : sameBefore - newV;
        const newPriceYes = parseFloat(formatUnits((newNo * 10n ** 6n) / (newYes + newNo), 6));
        setNewPrice(side === 'yes' ? newPriceYes : 1 - newPriceYes);

        setEstimatedUsdcE6(usdcOut);
        const minOut = (usdcOut * 9950n) / 10000n;
        setMinUsdcOutE6(minOut);
      }
    } catch (err) {
      console.error(err);
    }
  }, [amount, tradeMode, side, priceYesE6, reserveYes, reserveNo, virtualOffsetE18, totalFeeBps, sellFeesEnabled]);

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    if (tradeMode === 'buy' && needsUsdcApproval) {
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
      writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: side === 'yes' ? 'buyYes' : 'buyNo',
        args: [BigInt(marketId), parseUnits(amount, 6), minTokensOutE18 || 0n],
      });
    } else {
      writeContract({
        address: addresses.core,
        abi: coreAbi,
        functionName: side === 'yes' ? 'sellYes' : 'sellNo',
        args: [BigInt(marketId), parseUnits(amount, 18), minUsdcOutE6 || 0n],
      });
    }
  };

  const priceYes = priceYesE6 ? parseFloat(formatUnits(priceYesE6 as bigint, 6)) : 0;
  const priceNo = isPriceNoE6 ? parseFloat(formatUnits(isPriceNoE6 as bigint, 6)) : 0;
  const formatPrice = (p: number) => p >= 1 ? `$${p.toFixed(2)}` : `${(p * 100).toFixed(1)}¢`;

  // Balance checks
  const maxBuyAmount = parseFloat(usdcBalance) || 0;
  const maxSellAmount = side === 'yes' ? parseFloat(yesBalance) : parseFloat(noBalance);
  const inputAmount = parseFloat(amount) || 0;

  const canBuy = tradeMode === 'buy' && inputAmount <= maxBuyAmount && inputAmount > 0;
  const canSell = tradeMode === 'sell' && inputAmount <= maxSellAmount && inputAmount > 0;

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
            <div className="text-xs text-gray-500 mt-1">
              You have: {s === 'yes' ? yesBalance : noBalance}
            </div>
          </button>
        ))}
      </div>

      {/* Balance Info */}
      <div className="text-center text-sm text-gray-600">
        {tradeMode === 'buy' ? `USDC Balance: ${usdcBalance}` : `${side.toUpperCase()} Balance: ${side === 'yes' ? yesBalance : noBalance}`}
      </div>

      {/* Amount */}
      <input
        type="number"
        value={amount}
        onChange={e => {
          const val = e.target.value;
          const num = parseFloat(val) || 0;
          if (tradeMode === 'buy' && num > maxBuyAmount) return;
          if (tradeMode === 'sell' && num > maxSellAmount) return;
          setAmount(val);
        }}
        placeholder="0.0"
        className="w-full rounded-lg border px-4 py-3 text-lg font-semibold text-center focus:ring-2 focus:ring-green-500"
      />

      {/* Quick Buttons */}
      <div className="flex gap-2">
        {['10', '50', '100', 'Max'].map(q => (
          <button key={q} onClick={() => {
            const max = tradeMode === 'buy' ? maxBuyAmount : maxSellAmount;
            setAmount(q === 'Max' ? max.toString() : q);
          }}
            className="flex-1 bg-green-50 hover:bg-green-100 py-2 rounded-lg font-bold text-green-700">
            {q}
          </button>
        ))}
      </div>

      {/* REAL STATS PANEL */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Price change</span>
            <span className="font-bold">${currentPrice.toFixed(2)} to ${newPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shares</span>
            <span className="font-bold">{shares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Avg. price</span>
            <span className="font-bold">${avgPrice.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fee</span>
            <span className="font-bold">{feePercent.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-green-600 font-bold text-sm">
            <span className="text-gray-600">Max profit</span>
            <span>${maxProfit.toFixed(2)} (+{maxProfitPct.toFixed(1)}%)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Max payout</span>
            <span className="font-bold">${maxPayout.toFixed(0)}k</span>
          </div>
        </div>
      )}

      {/* ONE-CLICK APPROVE & TRADE */}
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
        {isApproving || isApprovalConfirming ? 'Approving...' :
         isPending || isConfirming ? 'Processing...' :
         needsUsdcApproval || needsTokenApproval ? 'Approve & Trade' :
         tradeMode.toUpperCase()}
      </button>
    </div>
  );
}

