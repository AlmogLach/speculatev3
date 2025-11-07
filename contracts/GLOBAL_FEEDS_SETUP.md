# Global Feeds Setup - Fully Automatic Market Resolution

## ✅ What Changed

The `ChainlinkResolver` now uses **global feeds** instead of per-market registration. This means:

1. **Deploy resolver once** ✅
2. **Register feeds once** (e.g., BTC/USD, ETH/USD) ✅
3. **Create markets freely** - they automatically use the global feeds ✅
4. **No manual registration needed** for each new market ✅

## 🚀 How It Works

### 1. Deploy Contracts

```bash
# Deploy SpeculateCore
forge script script/DeployAll.s.sol:DeployAll --rpc-url $BSC_TESTNET_RPC_URL --broadcast

# Deploy ChainlinkResolver  
forge script script/DeployUpdatedResolver.s.sol:DeployUpdatedResolver --rpc-url $BSC_TESTNET_RPC_URL --broadcast
```

### 2. Register Global Feeds

```bash
# Register common price feeds
forge script script/SetupGlobalFeeds.s.sol:SetupGlobalFeeds --rpc-url $BSC_TESTNET_RPC_URL --broadcast
```

This registers:
- **BTC/USD**: `keccak256("BTC/USD")` → Feed address
- **ETH/USD**: `keccak256("ETH/USD")` → Feed address  
- **BNB/USD**: `keccak256("BNB/USD")` → Feed address

### 3. Create Markets

When creating a market, you just specify the feed symbol:

```solidity
core.createMarket(
    "Will BTC be above $50,000 by Dec 31?",
    "Yes", "YES", "No", "NO",
    1000e18, 100, 500, 1000e6,
    expiryTimestamp,
    OracleType.ChainlinkFeed,
    address(0), // Not needed anymore!
    keccak256("BTC/USD"), // Feed ID - automatically connects!
    50000e8, // Target: $50,000
    Comparison.Above
);
```

**The resolver automatically:**
- Finds the feed using `keccak256("BTC/USD")`
- Resolves the market when it expires
- No manual registration needed!

## 📋 Feed Registration

### Current Registered Feeds (BSC Testnet)

- **BTC/USD**: `0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf`
- **ETH/USD**: `0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7`
- **BNB/USD**: `0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526`

### Adding New Feeds

```solidity
resolver.setGlobalFeed(
    keccak256("SOL/USD"), 
    0xYourFeedAddress
);
```

## 🎯 Frontend Integration

The frontend now:
- Shows a dropdown with feed symbols (BTC/USD, ETH/USD, BNB/USD)
- Automatically converts symbol to `bytes32` feed ID using `keccak256`
- No need to enter feed addresses manually

## 🔄 Backward Compatibility

The resolver still supports `oracleAddress` as a fallback:
1. First tries `globalFeeds[priceFeedId]`
2. Falls back to `resolution.oracleAddress` if global feed not found
3. This ensures old markets still work

## ✨ Benefits

✅ **Automatic**: New markets automatically work  
✅ **Scalable**: Add feeds once, use everywhere  
✅ **Simple**: No per-market registration  
✅ **Future-proof**: Works for all future markets  

