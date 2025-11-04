# 🎉 Deployment Successful!

Contracts deployed to BSC Testnet on November 2, 2025.

## 📋 Contract Addresses

### MockUSDC
```
0x75657FD3381999f08530838f84210efB01BF687a
```
- Token: Mock USDC (6 decimals)
- Purpose: Test collateral for predictions markets
- [View on BSCScan](https://testnet.bscscan.com/address/0x75657FD3381999f08530838f84210efB01BF687a)

### SpeculateCore
```
0xc8F51AF260399dFDC24f75Bb4fC67Da8cE7ce436
```
- Protocol: Main prediction market core
- Features: Pure CPMM, pair redemption, admin controls
- [View on BSCScan](https://testnet.bscscan.com/address/0xc8F51AF260399dFDC24f75Bb4fC67Da8cE7ce436)

## 📊 Deployment Details

- **Network**: BSC Testnet (Chain ID: 97)
- **Gas Used**: 3,913,873 gas
- **Cost**: 0.0003913873 BNB
- **Tx Hash**: See broadcast/Deploy.s.sol/97/run-latest.json

## ✅ Next Steps

### 1. Update Frontend Configuration

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_CORE_ADDRESS=0xc8F51AF260399dFDC24f75Bb4fC67Da8cE7ce436
NEXT_PUBLIC_USDC_ADDRESS=0x75657FD3381999f08530838f84210efB01BF687a
NEXT_PUBLIC_ADMIN_ADDRESS=0xYourAdminWallet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### 2. Copy ABIs

```powershell
cd speculate-v3\contracts
Copy-Item out\SpeculateCore.sol\SpeculateCore.json ..\frontend\lib\abis\
Copy-Item out\PositionToken.sol\PositionToken.json ..\frontend\lib\abis\
Copy-Item out\MockUSDC.sol\MockUSDC.json ..\frontend\lib\abis\
```

### 3. Install Frontend Dependencies

```powershell
cd ..\frontend
npm install
```

### 4. Run Frontend

```powershell
npm run dev
```

Open http://localhost:3000

## 🔍 Verify on BSCScan

To verify contracts (optional):

```powershell
cd contracts

# Verify MockUSDC
C:\Users\Almog\.foundry\bin\forge.exe verify-contract `
  0x75657FD3381999f08530838f84210efB01BF687a `
  src/MockUSDC.sol:MockUSDC `
  --chain bsc-testnet `
  --etherscan-api-key $env:BSCSCAN_API_KEY

# Verify SpeculateCore
C:\Users\Almog\.foundry\bin\forge.exe verify-contract `
  0xc8F51AF260399dFDC24f75Bb4fC67Da8cE7ce436 `
  src/SpeculateCore.sol:SpeculateCore `
  --chain bsc-testnet `
  --etherscan-api-key $env:BSCSCAN_API_KEY
```

## 🎮 First Steps

1. **Mint Test USDC**:
   - Call `mint()` on MockUSDC contract
   - Approve spending for SpeculateCore

2. **Create First Market**:
   - Use admin panel at `/admin`
   - Deposit initial liquidity
   - Start trading!

3. **Test Trading**:
   - Buy YES/NO positions
   - Close positions
   - Verify solvency

## 📚 Documentation

- [README.md](README.md) - Project overview
- [USER_GUIDE.md](docs/USER_GUIDE.md) - How to trade
- [ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) - Admin operations
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical design

## 🎉 Congratulations!

Your SpeculateX v3 prediction market is live on BSC Testnet!
