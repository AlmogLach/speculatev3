import { readContract } from 'wagmi/actions';
import { config } from './wagmi';
import { addresses } from './contracts';
import { formatUnits } from 'viem';
import { coreAbi } from './abis';

// Get market count
export async function getMarketCount(): Promise<bigint> {
  const result = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'marketCount',
    args: [],
  });
  return result as bigint;
}

// Get single market
export async function getMarket(id: bigint) {
  try {
  const result = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'markets',
    args: [id],
  }) as any;
  
    // SpeculateCore market structure (tuple order - 16 fields):
    // yes, no, reserveYes, reserveNo, usdcVault, totalPairsUSDC, virtualOffsetE18, feeTreasuryBps, feeVaultBps, feeLpBps, maxTradeBps, status, exists, sellFees, question, lp
    // viem may return an object with named fields or a tuple array
    const isObject = typeof result === 'object' && !Array.isArray(result) && result.yes !== undefined;
    
    if (isObject) {
      // Returned as named object
      const feeTreasury = Number(result.feeTreasuryBps || 0);
      const feeVault = Number(result.feeVaultBps || 0);
      const feeLp = Number(result.feeLpBps || 0);
      
      return {
        yes: result.yes,
        no: result.no,
        reserveYes: result.reserveYes,
        reserveNo: result.reserveNo,
        usdcVault: result.usdcVault,
        totalPairs: result.totalPairsUSDC,
        totalPairsUSDC: result.totalPairsUSDC,
        virtualOffsetE18: result.virtualOffsetE18 || 0n,
        feeTreasuryBps: result.feeTreasuryBps,
        feeVaultBps: result.feeVaultBps,
        feeLpBps: result.feeLpBps,
        maxTradeBps: result.maxTradeBps,
        status: result.status,
        exists: result.exists,
        sellFees: result.sellFees !== undefined ? result.sellFees : false,
        question: result.question || '',
        lp: result.lp || addresses.admin,
        // Back-compat fields
        feeBps: feeTreasury + feeVault + feeLp, // total fee for backward compatibility
        usdc: addresses.usdc,
        k: 0n,
        virtualYes: 0n,
        virtualNo: 0n,
        feeUSDC: 0n,
        expiry: 0n,
        creator: result.lp || addresses.admin,
        yesWins: false,
      };
    } else {
      // Returned as tuple array - handle both old (12 fields) and new (15 fields) structures
      const arrayLength = Array.isArray(result) ? result.length : 0;
      
      // New structure (15 fields)
      if (arrayLength >= 16) {
        const feeTreasury = Number(result[7] || 0);
        const feeVault = Number(result[8] || 0);
        const feeLp = Number(result[9] || 0);
        
        return {
          yes: result[0],
          no: result[1],
          reserveYes: result[2],
          reserveNo: result[3],
          usdcVault: result[4],
          totalPairs: result[5], // totalPairsUSDC
          totalPairsUSDC: result[5],
          virtualOffsetE18: 0n,
          virtualOffsetE18: result[6] || 0n,
          feeTreasuryBps: result[7],
          feeVaultBps: result[8],
          feeLpBps: result[9],
          maxTradeBps: result[10],
          status: result[11],
          exists: result[12],
          sellFees: result[13] !== undefined ? Boolean(result[13]) : false,
          question: result[14] || '',
          lp: result[15] || addresses.admin,
          // Back-compat fields
          feeBps: feeTreasury + feeVault + feeLp,
          usdc: addresses.usdc,
          k: 0n,
          virtualYes: 0n,
          virtualNo: 0n,
          feeUSDC: 0n,
          expiry: 0n,
          creator: result[15] || addresses.admin,
          yesWins: false,
        };
      } else {
        // Old structure (12 fields) - fallback for backward compatibility
        console.warn('Detected old contract structure, using fallback parsing');
        const oldFeeBps = Number(result[6] || 300); // Default 3% for old contracts
        
        return {
          yes: result[0],
          no: result[1],
          reserveYes: result[2],
          reserveNo: result[3],
          usdcVault: result[4],
          totalPairs: result[5] || 0n,
          totalPairsUSDC: result[5] || 0n,
          virtualOffsetE18: 0n,
          feeTreasuryBps: oldFeeBps, // Approximate split
          feeVaultBps: 0,
          feeLpBps: 0,
          maxTradeBps: result[7] || 500,
          status: result[8] || 0,
          exists: result[9] !== undefined ? Boolean(result[9]) : false,
          sellFees: false, // Old contracts don't have sell fees
          question: result[10] || '',
          lp: addresses.admin, // Default to admin for old contracts
          // Back-compat fields
          feeBps: oldFeeBps,
          usdc: addresses.usdc,
          k: 0n,
          virtualYes: 0n,
          virtualNo: 0n,
          feeUSDC: 0n,
          expiry: 0n,
          creator: addresses.admin,
          yesWins: false,
        };
      }
    }
  } catch (error: any) {
    console.error('Error loading market:', error);
    // Return a minimal market object to prevent crashes
  return {
      yes: addresses.usdc as `0x${string}`,
      no: addresses.usdc as `0x${string}`,
    reserveYes: 0n,
    reserveNo: 0n,
      usdcVault: 0n,
      totalPairs: 0n,
      totalPairsUSDC: 0n,
      virtualOffsetE18: 0n,
      feeTreasuryBps: 100,
      feeVaultBps: 50,
      feeLpBps: 50,
      maxTradeBps: 500,
      status: 0,
      exists: false,
      sellFees: false,
      question: 'Market not found',
      lp: addresses.admin,
      feeBps: 200,
      usdc: addresses.usdc,
    k: 0n,
    virtualYes: 0n,
    virtualNo: 0n,
      feeUSDC: 0n,
      expiry: 0n,
      creator: addresses.admin,
      yesWins: false,
  };
  }
}

// Get prices (SpeculateCore returns prices in E6, not E18)
export async function getPriceYes(marketId: bigint): Promise<string> {
  const price = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceYesE6',
    args: [marketId],
  }) as bigint;
  
  return formatUnits(price, 6); // Price is in E6 (0-1e6 range)
}

export async function getPriceNo(marketId: bigint): Promise<string> {
  const price = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceNoE6',
    args: [marketId],
  }) as bigint;
  
  return formatUnits(price, 6); // Price is in E6 (0-1e6 range)
}

// Get market resolution config
export async function getMarketResolution(id: bigint) {
  try {
    const result = await readContract(config, {
      address: addresses.core,
      abi: coreAbi,
      functionName: 'getMarketResolution',
      args: [id],
    }) as any;
    
    return {
      expiryTimestamp: result.expiryTimestamp || result[0] || 0n,
      oracleType: result.oracleType !== undefined ? Number(result.oracleType) : (result[1] !== undefined ? Number(result[1]) : 0),
      oracleAddress: result.oracleAddress || result[2] || '0x0000000000000000000000000000000000000000',
      priceFeedId: result.priceFeedId || result[3] || '0x0000000000000000000000000000000000000000000000000000000000000000',
      targetValue: result.targetValue || result[4] || 0n,
      comparison: result.comparison !== undefined ? Number(result.comparison) : (result[5] !== undefined ? Number(result[5]) : 0),
      yesWins: result.yesWins !== undefined ? Boolean(result.yesWins) : (result[6] !== undefined ? Boolean(result[6]) : false),
      isResolved: result.isResolved !== undefined ? Boolean(result.isResolved) : (result[7] !== undefined ? Boolean(result[7]) : false),
    };
  } catch (error) {
    console.error('Error loading market resolution:', error);
    return {
      expiryTimestamp: 0n,
      oracleType: 0,
      oracleAddress: '0x0000000000000000000000000000000000000000',
      priceFeedId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      targetValue: 0n,
      comparison: 0,
      yesWins: false,
      isResolved: false,
    };
  }
}

// Check if an address is an admin (SpeculateCore uses AccessControl)
export async function isAdmin(address: `0x${string}`): Promise<boolean> {
  try {
    // Check DEFAULT_ADMIN_ROLE (0x0)
    const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const hasAdminRole = await readContract(config, {
      address: addresses.core,
      abi: coreAbi,
      functionName: 'hasRole',
      args: [DEFAULT_ADMIN_ROLE as `0x${string}`, address],
    }) as boolean;
    
    return hasAdminRole;
  } catch (error) {
    console.error('Error checking admin status:', error);
    // Fallback to simple address comparison
    return address.toLowerCase() === addresses.admin.toLowerCase();
  }
}
