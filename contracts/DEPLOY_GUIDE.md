# Deployment Guide for BSC Testnet

## Prerequisites

1. ✅ Forge installed (already done)
2. ✅ `.env` file configured with PRIVATE_KEY
3. ✅ Deployer wallet funded with testnet BNB
4. ✅ BSCScan API key (optional, for verification)

## Step 1: Fund Deployer Wallet

Get testnet BNB from: https://testnet.binance.org/faucet-smart

Send BNB to your deployer wallet address.

## Step 2: Configure `.env`

Edit `contracts/.env`:

```env
PRIVATE_KEY=your_private_key_here
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=your_key_here
```

## Step 3: Deploy Contracts

```powershell
cd c:\Users\Almog\Desktop\ksp\speculate-v3\contracts

# Deploy to BSC Testnet
C:\Users\Almog\.foundry\bin\forge.exe script script/Deploy.s.sol `
  --rpc-url bsc_testnet `
  --broadcast `
  -vvvv
```

## Step 4: Save Deployment Addresses

After deployment, you'll see:
```
MockUSDC deployed at: 0x...
SpeculateCore deployed at: 0x...
```

Copy these addresses!

## Step 5: Verify Contracts (Optional)

```powershell
# Verify MockUSDC
C:\Users\Almog\.foundry\bin\forge.exe verify-contract `
  0xMOCK_USDC_ADDRESS `
  src/MockUSDC.sol:MockUSDC `
  --chain bsc-testnet `
  --etherscan-api-key $env:BSCSCAN_API_KEY

# Verify SpeculateCore
C:\Users\Almog\.foundry\bin\forge.exe verify-contract `
  0xCORE_ADDRESS `
  src/SpeculateCore.sol:SpeculateCore `
  --chain bsc-testnet `
  --etherscan-api-key $env:BSCSCAN_API_KEY
```

## Step 6: Update Frontend

1. Copy deployed addresses to `frontend/.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_CORE_ADDRESS=0x... (from deployment)
NEXT_PUBLIC_USDC_ADDRESS=0x... (from deployment)
NEXT_PUBLIC_ADMIN_ADDRESS=0x... (your admin wallet)
```

2. Copy ABIs to frontend:

```powershell
# Copy ABIs from out/ to frontend/lib/abis/
Copy-Item contracts\out\SpeculateCore.sol\SpeculateCore.json frontend\lib\abis\
Copy-Item contracts\out\PositionToken.sol\PositionToken.json frontend\lib\abis\
Copy-Item contracts\out\MockUSDC.sol\MockUSDC.json frontend\lib\abis\
```

## Step 7: Test

1. Mint test USDC
2. Create test market
3. Buy/sell positions
4. Verify solvency

## Troubleshooting

**"insufficient funds"**: Fund wallet with testnet BNB
**"nonce too low"**: Wait 30 seconds and retry
**"contract verification failed"**: Ensure BSCSCAN_API_KEY is valid
**"execution reverted"**: Check `-vvvv` output for details


