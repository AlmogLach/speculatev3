# 🚀 Quick Start Guide - SpeculateX v3

## ✅ Admin Panel is Ready!

The admin panel has been fully updated to work with wagmi v2. You can now:

1. **Create Markets** - Full CPMM prediction markets
2. **Manage Markets** - Pause/unpause and resolve
3. **View All Markets** - See all created markets

## 🏃 Running the UI

The dev server is already running on port 3000. Simply open:

**http://localhost:3000/admin**

## 📋 What You Need to Test

### 1. Connect Your Wallet
- Use the admin address: `0xBd0e87a678F3d53a27d1bB186cFC8Fd465433554`
- You'll need BNB for gas on BSC Testnet

### 2. Mint Test USDC
Call the `mint` function on the MockUSDC contract:
- Address: `0x75657FD3381999f08530838f84210efB01BF687a`
- Function: `mint(0xBd0e87a678F3d53a27d1bB186cFC8Fd465433554, 100000000)` (100 USDC)
- Get BNB from: https://testnet.binance.org/faucet-smart

### 3. Create a Market
1. Go to `/admin`
2. Fill in the form:
   - **Question**: "Will BTC reach $100k by 2026?"
   - **Initial Liquidity**: 1000 (or more)
   - **Expiry Date**: Pick a future date
3. Click "Create Market"
4. Approve USDC spending when prompted
5. Confirm the transaction

### 4. Check Your Market
The market will appear in the "Manage Markets" section. You can:
- **Pause** - Temporarily stop trading
- **Unpause** - Resume trading
- **Yes Wins** - Resolve with YES outcome
- **No Wins** - Resolve with NO outcome

## 🎉 All Done!

Your Polymarket-style prediction market is **fully functional**!

## 🐛 Troubleshooting

If you see errors:
1. Make sure MetaMask is connected to BSC Testnet (Chain ID: 97)
2. Make sure you have BNB for gas
3. Make sure you've minted USDC to your address
4. Check the browser console for detailed errors

## 📚 Next Steps

1. Create more markets with different questions
2. Add market browsing UI (will build this next)
3. Add trading interface for users
4. Add portfolio tracking
