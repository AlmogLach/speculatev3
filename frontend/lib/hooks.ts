import { readContract } from 'wagmi/actions';
import { config } from './wagmi';
import { addresses } from './contracts';
import { formatUnits } from 'viem';
import { coreAbi } from './abis';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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

    const isObject = !!result && typeof result === 'object' && !Array.isArray(result) && 'yes' in result;

    const yes = (isObject ? result.yes : result?.[0]) as `0x${string}` | undefined;
    const no = (isObject ? result.no : result?.[1]) as `0x${string}` | undefined;
    const qYes = BigInt(isObject ? result.qYes ?? 0n : result?.[2] ?? 0n);
    const qNo = BigInt(isObject ? result.qNo ?? 0n : result?.[3] ?? 0n);
    const usdcVault = BigInt(isObject ? result.usdcVault ?? 0n : result?.[4] ?? 0n);
    const totalPairsUSDC = BigInt(isObject ? result.totalPairsUSDC ?? 0n : result?.[5] ?? 0n);
    const bE18 = BigInt(isObject ? result.bE18 ?? 0n : result?.[6] ?? 0n);
    const feeTreasuryBps = Number(isObject ? result.feeTreasuryBps ?? 0 : result?.[7] ?? 0);
    const feeVaultBps = Number(isObject ? result.feeVaultBps ?? 0 : result?.[8] ?? 0);
    const feeLpBps = Number(isObject ? result.feeLpBps ?? 0 : result?.[9] ?? 0);
    const status = Number(isObject ? result.status ?? 0 : result?.[10] ?? 0);
    const question = (isObject ? result.question : result?.[11]) ?? '';
    const lp = (isObject ? result.lp : result?.[12]) as `0x${string}` | undefined;
    const resolutionRaw = isObject ? result.resolution : result?.[13];

    const resolution = {
      expiryTimestamp: BigInt(resolutionRaw?.expiryTimestamp ?? resolutionRaw?.[0] ?? 0n),
      oracleType: Number(resolutionRaw?.oracleType ?? resolutionRaw?.[1] ?? 0),
      oracleAddress: (resolutionRaw?.oracleAddress ?? resolutionRaw?.[2] ?? ZERO_ADDRESS) as `0x${string}`,
      priceFeedId: (resolutionRaw?.priceFeedId ?? resolutionRaw?.[3] ?? '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
      targetValue: BigInt(resolutionRaw?.targetValue ?? resolutionRaw?.[4] ?? 0n),
      comparison: Number(resolutionRaw?.comparison ?? resolutionRaw?.[5] ?? 0),
      yesWins: Boolean(resolutionRaw?.yesWins ?? resolutionRaw?.[6] ?? false),
      isResolved: Boolean(resolutionRaw?.isResolved ?? resolutionRaw?.[7] ?? false),
    };

    const exists = !!yes && yes !== ZERO_ADDRESS;

    return {
      yes: yes ?? ZERO_ADDRESS,
      no: no ?? ZERO_ADDRESS,
      qYes,
      qNo,
      usdcVault,
      totalPairsUSDC,
      bE18,
      feeTreasuryBps,
      feeVaultBps,
      feeLpBps,
      totalFeeBps: feeTreasuryBps + feeVaultBps + feeLpBps,
      status,
      question,
      lp: lp ?? ZERO_ADDRESS,
      resolution,
      exists,
    };
  } catch (error: any) {
    console.error('Error loading market:', error);
    // Return a minimal market object to prevent crashes
    return {
      yes: ZERO_ADDRESS,
      no: ZERO_ADDRESS,
      qYes: 0n,
      qNo: 0n,
      usdcVault: 0n,
      totalPairsUSDC: 0n,
      bE18: 0n,
      feeTreasuryBps: 0,
      feeVaultBps: 0,
      feeLpBps: 0,
      totalFeeBps: 0,
      status: 0,
      question: 'Market not found',
      lp: ZERO_ADDRESS,
      resolution: {
        expiryTimestamp: 0n,
        oracleType: 0,
        oracleAddress: ZERO_ADDRESS,
        priceFeedId: '0x0000000000000000000000000000000000000000000000000000000000000000',
        targetValue: 0n,
        comparison: 0,
        yesWins: false,
        isResolved: false,
      },
      exists: false,
    };
  }
}

// Get prices (SpeculateCore returns YES price in 1e18 precision)
export async function getPriceYes(marketId: bigint): Promise<string> {
  const priceE18 = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'spotPriceYesE18',
    args: [marketId],
  }) as bigint;

  return formatUnits(priceE18, 18);
}

export async function getPriceNo(marketId: bigint): Promise<string> {
  const yes = await getPriceYes(marketId);
  const yesFloat = parseFloat(yes);
  const noFloat = Math.max(0, 1 - yesFloat);
  return noFloat.toFixed(18);
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
      oracleAddress: result.oracleAddress || result[2] || ZERO_ADDRESS,
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
      oracleAddress: ZERO_ADDRESS,
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
