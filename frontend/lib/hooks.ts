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
    
    // SpeculateCore market structure (tuple order - 15 fields):
    // yes, no, reserveYes, reserveNo, usdcVault, totalPairsUSDC, feeTreasuryBps, feeVaultBps, feeLpBps, maxTradeBps, status, exists, sellFees, question, lp
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
      if (arrayLength >= 15) {
        const feeTreasury = Number(result[6] || 0);
        const feeVault = Number(result[7] || 0);
        const feeLp = Number(result[8] || 0);
        
        return {
          yes: result[0],
          no: result[1],
          reserveYes: result[2],
          reserveNo: result[3],
          usdcVault: result[4],
          totalPairs: result[5], // totalPairsUSDC
          totalPairsUSDC: result[5],
          feeTreasuryBps: result[6],
          feeVaultBps: result[7],
          feeLpBps: result[8],
          maxTradeBps: result[9],
          status: result[10],
          exists: result[11],
          sellFees: result[12] !== undefined ? Boolean(result[12]) : false,
          question: result[13] || '',
          lp: result[14] || addresses.admin,
          // Back-compat fields
          feeBps: feeTreasury + feeVault + feeLp,
          usdc: addresses.usdc,
          k: 0n,
          virtualYes: 0n,
          virtualNo: 0n,
          feeUSDC: 0n,
          expiry: 0n,
          creator: result[14] || addresses.admin,
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
