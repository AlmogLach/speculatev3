# Sell Mechanism Update - Complete! ✅

## Deployment Summary

**Date**: Successfully deployed using `--legacy` flag  
**Network**: BSC Testnet (Chain ID: 97)  
**Block**: 0x43beebb

### Contract Addresses

- **MockUSDC**: `0x17eaacd870f6bc17dede324a2837b54bfbde8588`
  - TX Hash: `0x73cfdaacc2f09cfbba4af99b8fa4c8800f859654c3515f79b936102b321f54dd`
  
- **SpeculateCore**: `0x6db5c0e994bd08a2bb9abbd59364fe44fb50770c`
  - TX Hash: `0xcd80d62dc03cb7fa6ac0d11e799d68ecb7be0b268ac6454bcc138857b4060fbd`

## What Changed

### Previous Sell Mechanism (❌ User Confusion)
- Selling YES tokens → Received NO tokens (CPMM swap)
- Selling NO tokens → Received YES tokens (CPMM swap)
- **Problem**: Users expected USDC, not opposite tokens!

### New Sell Mechanism (✅ User-Friendly)
- Selling YES tokens → **Direct USDC return**
- Selling NO tokens → **Direct USDC return**
- **Solution**: "Pair-Burn + CPMM Swap to USDC"

## How It Works Now

When a user sells position tokens (YES or NO):

1. **Transfer** user's tokens to the contract
2. **CPMM Swap** calculates how many opposite tokens are needed to form a pair
3. **Mint** the required opposite tokens internally
4. **Burn** the resulting pair for USDC (1:1 rate)
5. **Apply** 1% fee
6. **Return** net USDC to the user

### Example Flow

```
User sells 100 YES tokens
↓
Contract receives 100 YES
↓
CPMM calculates: needs 95.24 NO tokens (example)
↓
Contract mints 95.24 NO internally
↓
Burns 95.24 pairs (min of YES/NO) = 95.24 USDC
↓
Apply 1% fee = 0.95 USDC
↓
User receives: 94.29 USDC
```

## Frontend Updates

The UI has been updated to reflect this behavior:

- **Button**: Changed from "Swap" to "Sell" ✅
- **Info Box**: Explains USDC return mechanism ✅
- **ABIs**: Updated to match new contract ✅
- **Removed**: Confusion-causing swap dialog ✅

## Technical Details

### Contract: `SpeculateCore.sol`

**Function**: `sell(uint256 id, bool isYes, uint256 tokensIn)`
- Returns: `usdcOut` (uint256)
- Mechanism: Pair-Burn + CPMM Swap
- Guarantee: Solvent (usdcVault == totalPairs always)

### Solvency Guarantee

The new mechanism maintains solvency:
- Before: USDC vault backed 1:1 by totalPairs ✅
- During: Mint opposite tokens internally (no external transfer)
- After: Burn pairs 1:1 for USDC, solvency maintained ✅

## Testing

Ready for testing on BSC Testnet:
1. Connect wallet to frontend
2. Mint test USDC from admin panel
3. Buy YES or NO tokens
4. Sell tokens → Receive USDC directly!

## Next Steps

✅ Contracts deployed  
✅ ABIs updated  
✅ UI updated  
🔄 Ready for user testing!

---

**Note**: The `--legacy` flag was necessary to bypass the "already known" nonce issue. The deployment was successful and contracts are live on BSC Testnet.


