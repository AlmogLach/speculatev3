# Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Foundry installed (for contracts)
- BSC Testnet RPC URL
- Wallet with testnet BNB for gas
- Admin wallet address

## Contract Deployment

### 1. Install Dependencies

```bash
cd speculate-v3/contracts

# Install Foundry dependencies
forge install foundry-rs/forge-std openzeppelin/openzeppelin-contracts
```

### 2. Configure Environment

Create `.env` in contracts directory:

```env
PRIVATE_KEY=your_deployer_private_key
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=your_bscscan_api_key
```

### 3. Deploy

```bash
# Deploy contracts
forge script script/Deploy.s.sol --rpc-url bsc_testnet --broadcast -vvvv

# Output will show:
# MockUSDC deployed at: 0x...
# SpeculateCore deployed at: 0x...
```

### 4. Verify on BSCScan

```bash
# Verify MockUSDC
forge verify-contract 0xMOCK_USDC_ADDRESS src/MockUSDC.sol:MockUSDC --chain bsc-testnet --etherscan-api-key $BSCSCAN_API_KEY

# Verify SpeculateCore
forge verify-contract 0xCORE_ADDRESS src/SpeculateCore.sol:SpeculateCore \
  --constructor-args $(cast abi-encode "constructor()") \
  --chain bsc-testnet --etherscan-api-key $BSCSCAN_API_KEY
```

## Frontend Deployment

### 1. Get Contract ABIs

After deployment, extract ABIs:

```bash
cd speculate-v3/contracts

# Copy ABI files
cp out/SpeculateCore.sol/SpeculateCore.json ../../frontend/lib/abis/
cp out/MockUSDC.sol/MockUSDC.json ../../frontend/lib/abis/
cp out/PositionToken.sol/PositionToken.json ../../frontend/lib/abis/
```

### 2. Configure Frontend

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
NEXT_PUBLIC_CORE_ADDRESS=0xCORE_ADDRESS
NEXT_PUBLIC_USDC_ADDRESS=0xMOCK_USDC_ADDRESS
NEXT_PUBLIC_ADMIN_ADDRESS=0xYOUR_ADMIN_WALLET
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_wc_project_id
```

### 3. Install & Build

```bash
cd ../frontend
npm install
npm run build
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Or use Vercel dashboard:
1. Import GitHub repo
2. Add environment variables
3. Deploy

## Post-Deployment

### 1. Mint Test USDC

```bash
# Mint USDC for testing
cast send 0xMOCK_USDC_ADDRESS "mint(address,uint256)" \
  0xYOUR_ADDRESS 1000000000000 \
  --rpc-url bsc_testnet --private-key $PRIVATE_KEY
# (1000000000000 = 1,000,000 USDC with 6 decimals)
```

### 2. Create First Market

Use admin panel:
1. Connect admin wallet
2. Go to `/admin`
3. Create market with 1000 USDC initial liquidity

### 3. Test Trading

1. Get test USDC
2. Approve spending
3. Buy YES/NO
4. Close position
5. Verify solvency

## Production Checklist

- [ ] Multi-sig admin (Gnosis Safe)
- [ ] Real USDC (not mock)
- [ ] Security audit
- [ ] Insurance fund
- [ ] Monitoring dashboard
- [ ] Backup procedures
- [ ] Legal review
- [ ] Terms of service
- [ ] Bug bounty program


