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
  });
  return result as bigint;
}

// Get single market
export async function getMarket(id: bigint) {
  const result = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'markets',
    args: [id],
  }) as any;
  
  // Transform tuple to object for easier access (DirectCore)
  // Order: usdc, yes, no, usdcVault, feeBps, priceYesE18, feeUSDC, question, expiry, creator, status, yesWins
  return {
    usdc: result[0],
    yes: result[1],
    no: result[2],
    // Back-compat fields expected by UI
    reserveYes: 0n,
    reserveNo: 0n,
    k: 0n,
    virtualYes: 0n,
    virtualNo: 0n,
    usdcVault: result[3],
    totalPairs: result[3],
    feeBps: result[4],
    priceYesE18: result[5],
    feeUSDC: result[6],
    question: result[7],
    expiry: result[8],
    creator: result[9],
    status: result[10],
    yesWins: result[11],
  };
}

// Get prices
export async function getPriceYes(marketId: bigint): Promise<string> {
  const price = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'priceYesE18',
    args: [marketId],
  }) as bigint;
  
  return formatUnits(price, 18);
}

export async function getPriceNo(marketId: bigint): Promise<string> {
  const price = await readContract(config, {
    address: addresses.core,
    abi: coreAbi,
    functionName: 'priceNoE18',
    args: [marketId],
  }) as bigint;
  
  return formatUnits(price, 18);
}
