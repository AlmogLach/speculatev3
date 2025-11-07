# Dynamic Chainlink Automation Setup Guide

## ✅ Updated: One Upkeep For All Markets!

The `ChainlinkResolver` contract has been updated to automatically check **ALL markets** with a single Chainlink Automation upkeep. No more manual setup for each market!

## How It Works Now

### Single Upkeep Setup

1. **Create ONE Chainlink Automation upkeep** (just once!)
2. **Leave `checkData` EMPTY** (or set to `0x0000000000000000000000000000000000000000000000000000000000000001` to start from market 1)
3. **Chainlink automatically:**
   - Loops through all markets (1 to marketCount)
   - Finds the first market that needs resolution
   - Resolves it
   - Next run finds the next market that needs resolution
   - Continues until all markets are checked

### Setup Steps

#### 1. Deploy Updated Contract

First, deploy the updated `ChainlinkResolver` contract:

```bash
forge script script/DeployChainlinkResolver.s.sol:DeployChainlinkResolver \
  --rpc-url $BSC_TESTNET_RPC_URL \
  --broadcast
```

#### 2. Create Chainlink Automation Upkeep

Go to: https://automation.chain.link/new-time-based

**Configuration:**
- **Network**: BNB Chain Testnet (or your network)
- **Target Contract**: `0x0AAbB44843428D462A5da636c237b45c3c66a7Da` (your ChainlinkResolver address)
- **ABI**: Paste from `ChainlinkResolver_ABI.json`
- **Function**: `checkUpkeep(bytes)`
- **checkData**: **LEAVE EMPTY** or use `0x0000000000000000000000000000000000000000000000000000000000000001`
- **performData**: Leave empty (automatically handled)
- **Interval**: Every hour (3600 seconds)
- **Gas Limit**: 500,000

#### 3. That's It!

✅ **No more manual setup needed!**

Every time you create a new market with Chainlink resolution, it will automatically be checked by this single upkeep.

## How It Works Internally

### checkUpkeep Flow

```
1. Chainlink calls checkUpkeep(checkData)
   ↓
2. Contract gets start index from checkData (defaults to 1 if empty)
   ↓
3. Loops through markets starting from startIndex
   - Checks up to 50 markets per call (gas limit protection)
   - For each market, calls core.checkUpkeep(marketId)
   ↓
4. Returns first market that needs resolution
   - upkeepNeeded = true
   - performData = encoded market ID
   ↓
5. If no markets need resolution in this batch
   - upkeepNeeded = false
   - Next run starts from market 1 again
```

### performUpkeep Flow

```
1. Chainlink calls performUpkeep(performData)
   ↓
2. Contract decodes market ID from performData
   ↓
3. Gets price feed address (from registration or market config)
   ↓
4. Fetches current price from Chainlink
   ↓
5. Resolves market with price
   ↓
6. Emits MarketResolved event
```

## Gas Optimization

- **Batch Size**: Checks up to 50 markets per `checkUpkeep` call
- **Why**: Prevents gas limit issues with large market counts
- **Behavior**: If you have >50 markets, they're checked in batches across multiple upkeep cycles

## Market Registration

Before a market can be auto-resolved, it must be registered:

```solidity
resolver.registerMarket(marketId, priceFeedAddress);
```

**Note**: If a market is created with `oracleAddress` set, it can use that address directly without registration.

## Testing

### Test checkUpkeep

```bash
# Check if any markets need resolution (starts from market 1)
cast call $RESOLVER_ADDRESS "checkUpkeep(bytes)" "0x" --rpc-url $RPC_URL

# Check starting from market 10
cast call $RESOLVER_ADDRESS "checkUpkeep(bytes)" \
  $(cast abi-encode "f(uint256)" 10) \
  --rpc-url $RPC_URL
```

### Test performUpkeep

```bash
# First, get performData from checkUpkeep
# Then call performUpkeep with that data
cast send $RESOLVER_ADDRESS "performUpkeep(bytes)" $PERFORM_DATA \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

## Benefits

✅ **One upkeep handles all markets**  
✅ **No manual setup for new markets**  
✅ **Automatic scaling**  
✅ **Gas efficient** (batches of 50)  
✅ **Fault tolerant** (restarts from beginning each cycle)

## Troubleshooting

### Upkeep not finding markets

1. **Check market registration**: Ensure markets are registered with `registerMarket()`
2. **Check expiry**: Markets must have passed their `expiryTimestamp`
3. **Check oracle type**: Markets must have `oracleType = ChainlinkFeed`
4. **Check resolution status**: Markets must not already be resolved

### Gas limit issues

- The contract limits to 50 markets per check
- If you have >50 markets, they'll be checked across multiple cycles
- Consider increasing gas limit if needed (but 500k should be sufficient)

## Next Steps

1. Deploy updated contract
2. Create single Chainlink Automation upkeep
3. Create markets with Chainlink resolution
4. Markets will auto-resolve when they expire! 🎉

