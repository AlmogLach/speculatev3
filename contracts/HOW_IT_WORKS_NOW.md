# How ChainlinkResolver Currently Works

## Current Implementation (One Upkeep Per Market)

### What Happens Now:

1. **You create a market** with Chainlink resolution
2. **You manually create a Chainlink Automation upkeep** for that specific market
   - You encode the market ID (e.g., market 1) in `checkData`
   - Example: `checkData = 0x0000000000000000000000000000000000000000000000000000000000000001`
3. **Chainlink calls `checkUpkeep(checkData)`** every hour
   - The contract decodes the market ID from `checkData`
   - It checks if that ONE specific market needs resolution
   - Returns `(upkeepNeeded, performData)` where `performData` = encoded market ID
4. **If upkeep needed**, Chainlink calls `performUpkeep(performData)`
   - The contract resolves that ONE specific market

### The Problem:

❌ **You need to create a SEPARATE upkeep for EACH market manually**
- Market 1 → Upkeep 1 (checkData = market ID 1)
- Market 2 → Upkeep 2 (checkData = market ID 2)
- Market 3 → Upkeep 3 (checkData = market ID 3)
- ... and so on

This is **NOT scalable** - you'd have to manually create an upkeep every time you create a new market!

## What We Need (Dynamic - One Upkeep For All Markets)

### How It Should Work:

1. **You create markets** with Chainlink resolution
2. **You create ONE Chainlink Automation upkeep** (just once!)
   - `checkData` can be empty or contain a start index
3. **Chainlink calls `checkUpkeep(checkData)`** every hour
   - The contract loops through ALL markets (1 to marketCount)
   - Finds the FIRST market that:
     - Has `oracleType = ChainlinkFeed`
     - Has passed `expiryTimestamp`
     - Is not already resolved
   - Returns that market ID in `performData`
4. **If upkeep needed**, Chainlink calls `performUpkeep(performData)`
   - The contract resolves that market
5. **Next time** Chainlink runs, it finds the NEXT market that needs resolution
   - Automatically handles all markets!

### The Solution:

✅ **ONE upkeep handles ALL markets automatically**
- No manual setup needed for new markets
- Automatically finds and resolves markets that are ready
- Scales infinitely!

## Current Code Flow:

```
Chainlink Automation
    ↓
checkUpkeep(checkData) where checkData = encoded market ID
    ↓
Decode market ID from checkData
    ↓
Call core.checkUpkeep(marketId) - checks ONE market
    ↓
Return (upkeepNeeded, performData) where performData = same market ID
    ↓
If upkeepNeeded = true:
    performUpkeep(performData)
        ↓
    Resolve that ONE market
```

## What We Need to Change:

```
Chainlink Automation
    ↓
checkUpkeep(checkData) where checkData = empty or start index
    ↓
Loop through ALL markets (1 to marketCount)
    ↓
For each market:
    - Check if oracleType = ChainlinkFeed
    - Check if expiryTimestamp passed
    - Check if not resolved
    - If all true, return that market ID
    ↓
Return (upkeepNeeded, performData) where performData = first market that needs resolution
    ↓
If upkeepNeeded = true:
    performUpkeep(performData)
        ↓
    Resolve that market
    ↓
Next run finds the NEXT market that needs resolution
```

