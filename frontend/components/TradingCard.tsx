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
  
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  
  // Separate tracking for approval transaction
  const { data: approvalHash, writeContract: writeApprove, isPending: isApproving } = useWriteContract();
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });

  // Get market data to access token addresses
  // Note: DirectCore markets() returns: [usdc, yes, no, usdcVault, feeBps, priceYesE18, feeUSDC, question, expiry, creator, status, yesWins]
  const { data: marketData } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'markets',
    args: [BigInt(marketId)],
    query: {
      enabled: marketId > 0,
    },
  }) as any;

  // Extract token addresses from tuple (index 1 = yes, index 2 = no)
  const yesTokenAddress = marketData?.[1] as `0x${string}` | undefined;
  const noTokenAddress = marketData?.[2] as `0x${string}` | undefined;

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

  // Get market tuple for feeBps and other fields
  const { data: marketReserves } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'markets',
    args: [BigInt(marketId)],
    query: {
      enabled: marketId > 0,
    },
  }) as any;

  // Get current prices for estimation
  const { data: priceYesE18 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'priceYesE18',
    args: [BigInt(marketId)],
    query: {
      enabled: marketId > 0,
    },
  });

  const { data: priceNoE18 } = useReadContract({
    address: addresses.core,
    abi: coreAbi,
    functionName: 'priceNoE18',
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

  // Calculate estimated output using direct pricing: buy => net/price, sell => tokens*price
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !marketReserves) {
      setEstimatedOutput(null);
      return;
    }

    try {
      // DirectCore markets() returns: [usdc, yes, no, usdcVault, feeBps, priceYesE18, feeUSDC, question, expiry, creator, status, yesWins]
      const feeBps = marketReserves[4] ? Number(marketReserves[4]) : 100; // Default 1%
      const priceYesE18FromTuple = marketReserves[5] ? BigInt(marketReserves[5].toString()) : null;
      
      // Use price from tuple if available, otherwise fall back to hooks
      const currentPriceYesE18 = priceYesE18FromTuple || (priceYesE18 as bigint | null);
      const currentPriceNoE18 = currentPriceYesE18 ? (10n**18n - currentPriceYesE18) : null;

      if (!currentPriceYesE18 || currentPriceYesE18 === 0n) {
        console.log('Estimation: No price available', { priceYesE18FromTuple, priceYesE18, marketReserves });
        setEstimatedOutput(null);
        return;
      }

      console.log('Estimation inputs:', {
        amount,
        tradeMode,
        side,
        feeBps,
        priceYesE18: currentPriceYesE18.toString(),
        priceNoE18: currentPriceNoE18?.toString(),
      });

      if (tradeMode === 'buy') {
        // Direct pricing: tokens ≈ netUSDC / price
        const usdcIn = parseFloat(amount);
        const priceE18 = side === 'yes' ? currentPriceYesE18 : (currentPriceNoE18 || 0n);
        
        if (priceE18 === 0n) {
          setEstimatedOutput(null);
          return;
        }

        const usdcInBigInt = parseUnits(usdcIn.toFixed(6), 6);
        const fee = (usdcInBigInt * BigInt(feeBps)) / 10000n;
        const netUsdcBigInt = usdcInBigInt - fee;
        
        // tokensOutE18 = (netUsdc(6d) * 1e30) / priceE18
        // This matches DirectCore: tokensOut = (_usdcToE18(net) * ONE_E18) / p
        const tokensOutE18 = (netUsdcBigInt * 10n**30n) / priceE18;
        const tokensOut = parseFloat(formatUnits(tokensOutE18, 18));
        
        // Display the actual tokens you'll receive
        setEstimatedOutput(`≈ ${tokensOut.toFixed(4)} ${side.toUpperCase()} tokens`);
      } else {
        // Selling: gross = tokens * price; net = gross - fee
        const tokensIn = parseFloat(amount);
        const tokensInBigInt = parseUnits(tokensIn.toFixed(18), 18);
        const priceE18 = side === 'yes' ? currentPriceYesE18 : (currentPriceNoE18 || 0n);
        
        if (priceE18 === 0n) {
          setEstimatedOutput(null);
          return;
        }

        // grossE18 = (tokensIn * priceE18) / 1e18
        const grossE18 = (tokensInBigInt * priceE18) / 10n**18n;
        // Convert from 18 decimals to 6 decimals: grossE18 / 1e12
        const grossUsdc6 = grossE18 / 10n**12n;
        const fee = (grossUsdc6 * BigInt(feeBps)) / 10000n;
        const netUsdc = grossUsdc6 - fee;
        const usdcOutFormatted = parseFloat(formatUnits(netUsdc, 6));
        setEstimatedOutput(`≈ $${usdcOutFormatted.toFixed(2)} USDC`);
      }
    } catch (error) {
      console.error('Error calculating estimated output:', error);
      setEstimatedOutput(null);
    }
  }, [amount, tradeMode, side, marketReserves, priceYesE18, priceNoE18]);

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
        writeContract({
          address: addresses.core,
          abi: coreAbi,
          functionName: 'buy',
          args: [BigInt(marketId), side === 'yes', usdcAmount],
        });
      } else {
        // Selling returns USDC directly
        const tokenAmount = parseUnits(amount, 18);
        
        const confirmMessage = `Selling ${amount} ${side.toUpperCase()} tokens will return USDC (minus ~1% fee). Continue?`;
        if (!confirm(confirmMessage)) {
          return;
        }
        
        writeContract({
          address: addresses.core,
          abi: coreAbi,
          functionName: 'sell',
          args: [BigInt(marketId), side === 'yes', tokenAmount],
        });
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      alert('Trade failed. Check console for details.');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{question}</h3>
      
      {/* Balances */}
      {address && (
        <div className="mb-4 rounded-md bg-gray-50 p-4">
          <p className="text-xs text-gray-600 mb-2">Your Balances:</p>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-green-700">YES: {parseFloat(yesBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
            <span className="font-medium text-red-700">NO: {parseFloat(noBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
          </div>
          {(parseFloat(yesBalance) > 0 || parseFloat(noBalance) > 0) && (
            <div className="mt-3 rounded-md bg-green-50 p-3 border border-green-200">
              <p className="text-xs font-medium text-green-800 mb-2">💰 Selling Returns USDC:</p>
              <ul className="text-xs text-green-700 space-y-1">
                <li>• <strong>Selling {side === 'yes' ? 'YES' : 'NO'} tokens:</strong> Returns USDC directly</li>
                <li>• <strong>Mechanism:</strong> CPMM swap → mint pairs → burn pairs → receive USDC</li>
                <li>• <strong>You receive:</strong> USDC (minus ~1% fee)</li>
                <li>• <strong>Note:</strong> You don't need equal YES + NO pairs - selling returns USDC directly!</li>
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTradeMode('buy')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${
            tradeMode === 'buy'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setTradeMode('sell')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${
            tradeMode === 'sell'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Side Toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSide('yes')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold ${
            side === 'yes'
              ? 'bg-green-100 text-green-700 border-2 border-green-600'
              : 'bg-gray-50 text-gray-600 border-2 border-transparent'
          }`}
        >
          YES
        </button>
        <button
          onClick={() => setSide('no')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold ${
            side === 'no'
              ? 'bg-red-100 text-red-700 border-2 border-red-600'
              : 'bg-gray-50 text-gray-600 border-2 border-transparent'
          }`}
        >
          NO
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Amount ({tradeMode === 'buy' ? 'USDC' : `${side.toUpperCase()} Tokens`})
          </label>
          {address && (
            <button
              type="button"
              onClick={() => {
                if (tradeMode === 'buy') {
                  setAmount(usdcBalance);
                } else {
                  const balance = side === 'yes' ? yesBalance : noBalance;
                  setAmount(balance);
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              MAX
            </button>
          )}
        </div>
        {tradeMode === 'sell' && (
          <div className="mb-2 mt-1 rounded-md bg-blue-50 p-3 border border-blue-200">
            <p className="text-xs font-medium text-blue-800 mb-1">
              💰 Selling {side.toUpperCase()} tokens returns USDC
            </p>
            <p className="text-xs text-blue-700">
              Direct pricing: you receive price × tokens in USDC (minus fee).
            </p>
          </div>
        )}
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm pr-20"
            placeholder="0.00"
          />
          {address && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              {tradeMode === 'buy' ? `Balance: ${parseFloat(usdcBalance).toFixed(2)} USDC` : 
               `Balance: ${parseFloat(side === 'yes' ? yesBalance : noBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${side.toUpperCase()}`}
            </div>
          )}
        </div>
        {estimatedOutput && (
          <div className="mt-2 rounded-md bg-blue-50 p-2 border border-blue-200">
            <p className="text-xs font-medium text-blue-800 mb-1">Estimated Output:</p>
            <p className="text-sm font-semibold text-blue-900">{estimatedOutput}</p>
          </div>
        )}
      </div>

      {/* Approve Button */}
      {address && (
        <>
          {/* Show approval button for buy mode */}
          {needsApproval && tradeMode === 'buy' && (
            <button
              onClick={handleApprove}
              disabled={isApproving || isApprovalConfirming || isPending || isConfirming}
              className="w-full mb-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              {(isApproving || isApprovalConfirming) ? 'Approving...' : 'Approve USDC'}
            </button>
          )}
          {/* Show approval button for sell mode */}
          {needsTokenApproval && tradeMode === 'sell' && tokenAddressForSell && (
            <button
              onClick={handleApprove}
              disabled={isApproving || isApprovalConfirming || isPending || isConfirming}
              className="w-full mb-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
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
          !address
        }
        className={`w-full rounded-md px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${
          tradeMode === 'buy' 
            ? 'bg-green-600 hover:bg-green-500' 
            : 'bg-blue-600 hover:bg-blue-500'
        }`}
      >
        {(isPending || isConfirming) 
          ? 'Processing...' 
          : tradeMode === 'buy' 
            ? `Buy ${side.toUpperCase()} (pay USDC)` 
            : `Sell ${side.toUpperCase()} (receive USDC)`}
      </button>
    </div>
  );
}

