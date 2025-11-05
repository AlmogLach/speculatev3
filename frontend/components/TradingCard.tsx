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
  const [setExpiration, setSetExpiration] = useState(false);
  
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  // Separate tracking for approval transaction
  const { data: approvalHash, writeContract: writeApprove, isPending: isApproving } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });

  // Get market data to access token addresses
  // SpeculateCore markets() returns: [yes, no, reserveYes, reserveNo, usdcVault, totalPairsUSDC, feeTreasuryBps, feeVaultBps, feeLpBps, maxTradeBps, status, exists, sellFees, question, lp]
  const { data: marketData } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'markets',
    args: [BigInt(marketId)],
    query: {
      enabled: marketId > 0,
    },
  }) as any;

  // Extract token addresses from tuple (index 0 = yes, index 1 = no)
  // Handle both object and array formats
  const isMarketDataObject = marketData && typeof marketData === 'object' && !Array.isArray(marketData) && marketData.yes !== undefined;
  const yesTokenAddress = isMarketDataObject 
    ? (marketData.yes as `0x${string}`)
    : (marketData?.[0] as `0x${string}` | undefined);
  const noTokenAddress = isMarketDataObject
    ? (marketData.no as `0x${string}`)
    : (marketData?.[1] as `0x${string}` | undefined);

  // Debug logging
  useEffect(() => {
    if (marketData) {
      console.log('Market data:', marketData);
      console.log('YES token address:', yesTokenAddress);
      console.log('NO token address:', noTokenAddress);
    }
  }, [marketData, yesTokenAddress, noTokenAddress]);

  // Get user's USDC balance
  const { data: usdcBal, refetch: refetchUsdcBalance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && addresses.usdc),
      refetchInterval: (isConfirming || isPending) ? 2000 : false,
    },
  });

  // Get user's token balances
  const { data: yesBal, refetch: refetchYesBalance } = useReadContract({
    address: yesTokenAddress,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && yesTokenAddress),
      // Refetch while transaction is confirming
      refetchInterval: (isConfirming || isPending) ? 2000 : false,
    },
  });

  const { data: noBal, refetch: refetchNoBalance } = useReadContract({
    address: noTokenAddress,
    abi: positionTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && noTokenAddress),
      // Refetch while transaction is confirming
      refetchInterval: (isConfirming || isPending) ? 2000 : false,
    },
  });

  // Get market data for feeBps and other fields (same as marketData above, but keeping for compatibility)
  const marketReserves = marketData;

  // Get current prices for estimation (SpeculateCore uses E6, not E18)
  const { data: priceYesE6 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceYesE6',
    args: [BigInt(marketId)],
    query: {
      enabled: marketId > 0,
    },
  });

  const { data: priceNoE6 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceNoE6',
    args: [BigInt(marketId)],
    query: {
      enabled: marketId > 0,
    },
  });

  // Update balances
  useEffect(() => {
    if (usdcBal !== undefined && usdcBal !== null) {
      const formatted = formatUnits(usdcBal as bigint, 6);
      setUsdcBalance(formatted);
    }
    if (yesBal !== undefined && yesBal !== null) {
      const formatted = formatUnits(yesBal as bigint, 18);
      setYesBalance(formatted);
      console.log('YES Balance updated:', formatted, 'from raw:', yesBal);
    }
    if (noBal !== undefined && noBal !== null) {
      const formatted = formatUnits(noBal as bigint, 18);
      setNoBalance(formatted);
      console.log('NO Balance updated:', formatted, 'from raw:', noBal);
    }
  }, [usdcBal, yesBal, noBal]);

  // Calculate estimated output using SpeculateCore linear AMM: buy => mulDiv(netUsdc, 1e18, priceE6), sell => mulDiv(tokens, priceE6, 1e18)
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setEstimatedOutput(null);
      return;
    }

    try {
      // Get fee structure from market data
      const isMarketReservesObject = marketReserves && typeof marketReserves === 'object' && !Array.isArray(marketReserves) && marketReserves.feeTreasuryBps !== undefined;
      const feeTreasuryBps = isMarketReservesObject 
        ? Number(marketReserves.feeTreasuryBps || 0)
        : Number(marketReserves?.[6] || 0);
      const feeVaultBps = isMarketReservesObject 
        ? Number(marketReserves.feeVaultBps || 0)
        : Number(marketReserves?.[7] || 0);
      const feeLpBps = isMarketReservesObject 
        ? Number(marketReserves.feeLpBps || 0)
        : Number(marketReserves?.[8] || 0);
      const totalFeeBps = feeTreasuryBps + feeVaultBps + feeLpBps;
      
      // Use prices from hooks (E6 format)
      const currentPriceYesE6 = priceYesE6 as bigint | null;
      const currentPriceNoE6 = priceNoE6 as bigint | null;

      if (!currentPriceYesE6 || !currentPriceNoE6 || currentPriceYesE6 === 0n || currentPriceNoE6 === 0n) {
        console.log('Estimation: No price available', { priceYesE6, priceNoE6 });
        setEstimatedOutput(null);
        return;
      }

      console.log('Estimation inputs:', {
        amount,
        tradeMode,
        side,
        totalFeeBps,
        priceYesE6: currentPriceYesE6.toString(),
        priceNoE6: currentPriceNoE6.toString(),
      });

      if (tradeMode === 'buy') {
        // SpeculateCore: tokens = mulDiv(netUsdc, 1e18, priceE6)
        const usdcIn = parseFloat(amount);
        const priceE6 = side === 'yes' ? currentPriceYesE6 : currentPriceNoE6;

        const usdcInBigInt = parseUnits(usdcIn.toFixed(6), 6);
        const fee = (usdcInBigInt * BigInt(totalFeeBps)) / 10000n;
        const netUsdcBigInt = usdcInBigInt - fee;
        
        // tokensOut = (netUsdc(6d) * 1e18) / priceE6
        // This matches SpeculateCore: Math.mulDiv(netUsdc, 1e18, priceE6)
        const tokensOutE18 = (netUsdcBigInt * 10n**18n) / priceE6;
        const tokensOut = parseFloat(formatUnits(tokensOutE18, 18));
        
        // Display the actual tokens you'll receive
        setEstimatedOutput(`≈ ${tokensOut.toFixed(4)} ${side.toUpperCase()} tokens`);
      } else {
        // Selling: SpeculateCore: grossUsdc = mulDiv(tokensIn, priceE6, 1e18)
        const tokensIn = parseFloat(amount);
        const tokensInBigInt = parseUnits(tokensIn.toFixed(18), 18);
        const priceE6 = side === 'yes' ? currentPriceYesE6 : currentPriceNoE6;
        
        // grossUsdc(6d) = (tokensIn(18d) * priceE6) / 1e18
        const grossUsdc6 = (tokensInBigInt * priceE6) / 10n**18n;
        // For sells: fees only if sellFees is enabled (default is fee-free)
        const fee = totalFeeBps > 0 ? (grossUsdc6 * BigInt(totalFeeBps)) / 10000n : 0n;
        const netUsdc = grossUsdc6 - fee;
        const usdcOutFormatted = parseFloat(formatUnits(netUsdc, 6));
        setEstimatedOutput(`≈ $${usdcOutFormatted.toFixed(2)} USDC`);
      }
    } catch (error) {
      console.error('Error calculating estimated output:', error);
      setEstimatedOutput(null);
    }
  }, [amount, tradeMode, side, marketReserves, priceYesE6, priceNoE6]);

  // Check USDC approval for buying
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: addresses.usdc,
    abi: usdcAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: {
      enabled: !!(address && addresses.usdc && addresses.core && tradeMode === 'buy'),
      refetchInterval: isApprovalConfirming ? 1000 : false,
    },
  });

  // Check position token approval for selling
  const tokenAddressForSell = tradeMode === 'sell' && side === 'yes' ? yesTokenAddress : 
                               tradeMode === 'sell' && side === 'no' ? noTokenAddress : 
                               undefined;

  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({
    address: tokenAddressForSell,
    abi: positionTokenAbi,
    functionName: 'allowance',
    args: address && addresses.core ? [address, addresses.core] : undefined,
    query: {
      enabled: !!(address && addresses.core && tokenAddressForSell && tradeMode === 'sell'),
      refetchInterval: isApprovalConfirming ? 1000 : false,
    },
  });

  // Debug logging for token allowance
  useEffect(() => {
    if (tradeMode === 'sell' && tokenAddressForSell) {
      console.log('Sell mode - Token allowance query:', {
        tokenAddress: tokenAddressForSell,
        address,
        coreAddress: addresses.core,
        enabled: !!(address && addresses.core && tokenAddressForSell && tradeMode === 'sell'),
        tokenAllowance: tokenAllowance?.toString(),
        side
      });
    }
  }, [tradeMode, side, tokenAddressForSell, tokenAllowance, address]);

  useEffect(() => {
    if (usdcAllowance && tradeMode === 'buy' && amount) {
      try {
        const required = parseUnits(amount, 6);
        const needs = (usdcAllowance as bigint) < required;
        setNeedsApproval(needs);
        console.log('USDC Approval check:', {
          allowance: (usdcAllowance as bigint).toString(),
          required: required.toString(),
          needsApproval: needs,
          contractAddress: addresses.core,
          usdcAddress: addresses.usdc
        });
      } catch (error) {
        console.error('Error checking USDC allowance:', error);
        setNeedsApproval(false);
      }
    } else if (tradeMode === 'buy' && amount && !usdcAllowance) {
      // If we have amount but no allowance data yet, assume we need approval
      console.log('USDC allowance not loaded yet, assuming approval needed');
      setNeedsApproval(true);
    } else {
      setNeedsApproval(false);
    }
  }, [usdcAllowance, tradeMode, amount]);

  useEffect(() => {
    if (tradeMode === 'sell' && amount && tokenAddressForSell) {
      try {
        const required = parseUnits(amount, 18);
        // If allowance is undefined/null or less than required, need approval
        const allowanceValue = tokenAllowance as bigint | undefined;
        
        // If we haven't gotten the allowance yet but have an amount, assume we need approval
        // This prevents the button from not showing while the query is loading
        if (allowanceValue === undefined) {
          // Query might still be loading, but if we have amount entered, show approval needed
          setNeedsTokenApproval(true);
          console.log('Token allowance check: Allowance not loaded yet, assuming approval needed');
        } else {
          const needsApproval = allowanceValue < required;
          setNeedsTokenApproval(needsApproval);
          console.log('Token allowance check:', {
            tradeMode,
            amount,
            tokenAllowance: allowanceValue.toString(),
            required: required.toString(),
            needsApproval,
            tokenAddress: tokenAddressForSell
          });
        }
      } catch (error) {
        console.error('Error checking token allowance:', error);
        // If there's an error parsing, assume approval is needed
        setNeedsTokenApproval(true);
      }
    } else if (tradeMode === 'sell' && amount && !tokenAddressForSell) {
      // If we're in sell mode with amount but don't have token address yet, wait
      console.log('Waiting for token address...', { yesTokenAddress, noTokenAddress, side });
      setNeedsTokenApproval(false);
    } else {
      setNeedsTokenApproval(false);
    }
  }, [tokenAllowance, tradeMode, amount, side, tokenAddressForSell, yesTokenAddress, noTokenAddress]);

  // Refresh allowance after successful approval
  useEffect(() => {
    if (isApprovalSuccess) {
      if (tradeMode === 'buy') {
        refetchAllowance();
        setNeedsApproval(false);
      } else {
        refetchTokenAllowance();
        setNeedsTokenApproval(false);
      }
    }
  }, [isApprovalSuccess, refetchAllowance, refetchTokenAllowance, tradeMode]);

  // Refetch balances after successful trade
  useEffect(() => {
    if (isSuccess) {
      // Small delay to ensure blockchain state is updated, then refetch
      const timeoutId = setTimeout(() => {
        refetchYesBalance();
        refetchNoBalance();
        refetchUsdcBalance();
      }, 1000);
      
      alert('Trade successful!');
      setAmount('');
      
      return () => clearTimeout(timeoutId);
    }
  }, [isSuccess, refetchYesBalance, refetchNoBalance, refetchUsdcBalance]);

  const handleApprove = async () => {
    if (!amount || !addresses.core) {
      alert('Missing required information for approval');
      return;
    }
    
    try {
      if (tradeMode === 'buy') {
        // Approve USDC for buying
        if (!addresses.usdc) {
          alert('USDC address not configured');
          return;
        }
        const amountParsed = parseUnits(amount, 6);
        const approvalAmount = amountParsed * BigInt(1000);
        
        writeApprove({
          address: addresses.usdc,
          abi: usdcAbi,
          functionName: 'approve',
          args: [addresses.core, approvalAmount],
        });
      } else {
        // Approve position token for selling
        const tokenAddress = side === 'yes' ? yesTokenAddress : noTokenAddress;
        if (!tokenAddress) {
          alert('Token address not available');
          return;
        }
        const amountParsed = parseUnits(amount, 18);
        const approvalAmount = amountParsed * BigInt(1000);
        
        writeApprove({
          address: tokenAddress,
          abi: positionTokenAbi,
          functionName: 'approve',
          args: [addresses.core, approvalAmount],
        });
      }
    } catch (error) {
      console.error('Error approving token:', error);
      alert(`Failed to approve ${tradeMode === 'buy' ? 'USDC' : 'token'}. Please check console for details.`);
    }
  };

  const handleTrade = async () => {
    if (!amount) {
      alert('Please enter an amount');
      return;
    }

    // Double-check approval before trading
    if (tradeMode === 'buy') {
      if (!usdcAllowance || (usdcAllowance as bigint) < parseUnits(amount, 6)) {
        alert(`Please approve USDC first. The contract address is ${addresses.core}. Click the "Approve USDC" button.`);
        return;
      }
    }

    if (tradeMode === 'sell') {
      if (!tokenAllowance || (tokenAllowance as bigint) < parseUnits(amount, 18)) {
        alert(`Please approve the position token first. Click the "Approve Token" button.`);
        return;
      }
    }

    try {
      if (tradeMode === 'buy') {
        const usdcAmount = parseUnits(amount, 6);
        // Calculate minimum output (with 5% slippage tolerance)
        const isMarketReservesObject = marketReserves && typeof marketReserves === 'object' && !Array.isArray(marketReserves);
        const priceE6 = side === 'yes' ? (priceYesE6 as bigint) : (priceNoE6 as bigint);
        const feeTreasuryBps = isMarketReservesObject 
          ? Number(marketReserves.feeTreasuryBps || 0)
          : Number(marketReserves?.[6] || 0);
        const feeVaultBps = isMarketReservesObject 
          ? Number(marketReserves.feeVaultBps || 0)
          : Number(marketReserves?.[7] || 0);
        const feeLpBps = isMarketReservesObject 
          ? Number(marketReserves.feeLpBps || 0)
          : Number(marketReserves?.[8] || 0);
        const totalFeeBps = feeTreasuryBps + feeVaultBps + feeLpBps;
        
        const fee = (usdcAmount * BigInt(totalFeeBps)) / 10000n;
        const netUsdc = usdcAmount - fee;
        const estimatedTokens = (netUsdc * 10n**18n) / priceE6;
        const minOut = (estimatedTokens * 95n) / 100n; // 5% slippage tolerance
        
        writeContract({
          address: addresses.core,
          abi: coreAbi,
          functionName: side === 'yes' ? 'buyYes' : 'buyNo',
          args: [BigInt(marketId), usdcAmount, minOut],
        });
      } else {
        // Selling returns USDC directly
        const tokenAmount = parseUnits(amount, 18);
        
        // Calculate minimum USDC output (with 5% slippage tolerance)
        const priceE6 = side === 'yes' ? (priceYesE6 as bigint) : (priceNoE6 as bigint);
        const isMarketReservesObject = marketReserves && typeof marketReserves === 'object' && !Array.isArray(marketReserves);
        const sellFeesEnabled = isMarketReservesObject 
          ? Boolean(marketReserves.sellFees)
          : Boolean(marketReserves?.[12] || false);
        const feeTreasuryBps = isMarketReservesObject 
          ? Number(marketReserves.feeTreasuryBps || 0)
          : Number(marketReserves?.[6] || 0);
        const feeVaultBps = isMarketReservesObject 
          ? Number(marketReserves.feeVaultBps || 0)
          : Number(marketReserves?.[7] || 0);
        const feeLpBps = isMarketReservesObject 
          ? Number(marketReserves.feeLpBps || 0)
          : Number(marketReserves?.[8] || 0);
        const totalFeeBps = sellFeesEnabled ? (feeTreasuryBps + feeVaultBps + feeLpBps) : 0;
        
        const grossUsdc = (tokenAmount * priceE6) / 10n**18n;
        const fee = totalFeeBps > 0 ? (grossUsdc * BigInt(totalFeeBps)) / 10000n : 0n;
        const estimatedUsdc = grossUsdc - fee;
        const minUsdcOut = (estimatedUsdc * 95n) / 100n; // 5% slippage tolerance
        
        const feeText = sellFeesEnabled ? `minus ${totalFeeBps/100}% fee` : 'fee-free';
        const confirmMessage = `Selling ${amount} ${side.toUpperCase()} tokens will return ~${formatUnits(estimatedUsdc, 6)} USDC (${feeText}). Continue?`;
        if (!confirm(confirmMessage)) {
          return;
        }
        
        writeContract({
          address: addresses.core,
          abi: coreAbi,
          functionName: side === 'yes' ? 'sellYes' : 'sellNo',
          args: [BigInt(marketId), tokenAmount, minUsdcOut],
        });
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      alert('Trade failed. Check console for details.');
    }
  };

  // Calculate prices for display
  const priceYes = priceYesE6 ? parseFloat(formatUnits(priceYesE6 as bigint, 6)) : 0;
  const priceNo = priceNoE6 ? parseFloat(formatUnits(priceNoE6 as bigint, 6)) : 0;
  
  // Format price for display (0-1 range to dollar format)
  const formatPrice = (price: number): string => {
    const cents = price * 100;
    if (cents >= 100) {
      return `$${cents.toFixed(2)}`;
    }
    const formatted = cents.toFixed(1).replace(/\.0$/, '');
    return `${formatted}¢`;
  };

  // Calculate total cost
  const totalCost = amount && parseFloat(amount) > 0 
    ? (tradeMode === 'buy' ? parseFloat(amount) : (parseFloat(amount) * (side === 'yes' ? priceYes : priceNo)))
    : 0;

  // Quick amount buttons
  const quickAmounts = ['10', '50', '100', 'Max'];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* BUY/SELL Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTradeMode('buy')}
          className={`flex-1 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold transition-all ${
            tradeMode === 'buy'
              ? 'bg-green-500 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => setTradeMode('sell')}
          className={`flex-1 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold transition-all ${
            tradeMode === 'sell'
              ? 'bg-green-500 text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          SELL
        </button>
      </div>

      {/* YES/NO Price Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <button
          onClick={() => setSide('yes')}
          className={`bg-green-50 hover:bg-green-100 rounded-xl p-3 sm:p-4 text-left transition-all ${
            side === 'yes' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <div className="text-[10px] sm:text-xs font-bold text-green-600">YES</div>
            <div className="text-[10px] sm:text-xs font-bold text-gray-600">{formatPrice(priceYes)}</div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-gray-900">{formatPrice(priceYes)}</div>
        </button>
        <button
          onClick={() => setSide('no')}
          className={`bg-red-50 hover:bg-red-100 rounded-xl p-3 sm:p-4 text-left transition-all ${
            side === 'no' ? 'ring-2 ring-red-500' : ''
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
            <div className="text-[10px] sm:text-xs font-bold text-red-600">NO</div>
            <div className="text-[10px] sm:text-xs font-bold text-gray-600">{formatPrice(priceNo)}</div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-600">{formatPrice(priceNo)}</div>
        </button>
      </div>

      {/* Amount Input with +/- buttons */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Amount</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const current = parseFloat(amount) || 0;
              const newAmount = Math.max(0, current - (tradeMode === 'buy' ? 1 : 0.1));
              setAmount(newAmount.toFixed(tradeMode === 'buy' ? 2 : 4));
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold transition-colors text-sm sm:text-base"
          >
            −
          </button>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 sm:px-4 py-2 sm:py-3 text-center text-base sm:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="0.0"
            step={tradeMode === 'buy' ? '0.1' : '0.01'}
          />
          <button
            onClick={() => {
              const current = parseFloat(amount) || 0;
              const newAmount = current + (tradeMode === 'buy' ? 1 : 0.1);
              setAmount(newAmount.toFixed(tradeMode === 'buy' ? 2 : 4));
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold transition-colors text-sm sm:text-base"
          >
            +
          </button>
        </div>
      </div>

      {/* Balance and Shares */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-xs sm:text-sm">
        <div>
          <span className="text-gray-500">Balance: </span>
          <span className="font-bold text-gray-900">
            {address 
              ? (tradeMode === 'buy' 
                  ? `${parseFloat(usdcBalance).toFixed(2)} USDC`
                  : `${parseFloat(side === 'yes' ? yesBalance : noBalance).toFixed(4)} ${side.toUpperCase()}`)
              : '--'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Shares: </span>
          <span className="font-bold text-gray-900">
            {address 
              ? (side === 'yes' 
                  ? parseFloat(yesBalance).toFixed(4)
                  : parseFloat(noBalance).toFixed(4))
              : '0'}
          </span>
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="flex gap-2">
        {quickAmounts.map((qty) => (
          <button
            key={qty}
            onClick={() => {
              if (qty === 'Max') {
                if (tradeMode === 'buy') {
                  setAmount(usdcBalance);
                } else {
                  const balance = side === 'yes' ? yesBalance : noBalance;
                  setAmount(balance);
                }
              } else {
                setAmount(qty);
              }
            }}
            className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg py-2 px-2 sm:px-3 text-xs sm:text-sm font-bold transition-colors"
          >
            {qty}
          </button>
        ))}
      </div>

      {/* Set Expiration Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-medium text-gray-700">Set Expiration</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={setExpiration}
            onChange={(e) => setSetExpiration(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
        </label>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-200">
        <span className="text-xs sm:text-sm font-medium text-gray-700">Total</span>
        <span className="text-base sm:text-lg font-black text-gray-900">
          ${totalCost.toFixed(2)}
        </span>
      </div>

      {/* Approve Button */}
      {address && (
        <>
          {needsApproval && tradeMode === 'buy' && (
            <button
              onClick={handleApprove}
              disabled={isApproving || isApprovalConfirming || isPending || isConfirming}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {(isApproving || isApprovalConfirming) ? 'Approving...' : 'Approve USDC'}
            </button>
          )}
          {needsTokenApproval && tradeMode === 'sell' && tokenAddressForSell && (
            <button
              onClick={handleApprove}
              disabled={isApproving || isApprovalConfirming || isPending || isConfirming}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {(isApproving || isApprovalConfirming) ? 'Approving...' : `Approve ${side.toUpperCase()} Token`}
            </button>
          )}
        </>
      )}

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={
          isPending || 
          isConfirming || 
          isApproving || 
          isApprovalConfirming || 
          needsApproval || 
          needsTokenApproval ||
          !address ||
          !amount ||
          parseFloat(amount) <= 0
        }
        className="w-full rounded-lg bg-green-500 px-4 py-3 sm:py-4 text-sm sm:text-base font-bold text-white shadow-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {(isPending || isConfirming) 
          ? 'Processing...' 
          : tradeMode === 'buy' 
            ? 'Buy' 
            : 'Sell'}
      </button>

      {/* Disclaimer */}
      <p className="text-xs text-gray-500 text-center">
        By trading, you agree to the Privacy and Terms.
      </p>
    </div>
  );
}

