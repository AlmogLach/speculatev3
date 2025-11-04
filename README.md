# SpeculateX v3 - Prediction Market Platform

A decentralized prediction market platform built on BNB Smart Chain (BSC) Testnet using DirectCore pricing mechanism.

## Features

- **Direct Pricing Model**: Simple USDC ↔ YES/NO token pricing where price = per-token cost
- **No Initial Liquidity Required**: Markets start with just an initial price (e.g., 50/50)
- **Admin Controls**: 
  - Create markets with configurable fees (0.1% - 10%)
  - Adjustable price sensitivity
  - Market pause/unpause functionality
- **Treasury System**: Collects and manages trading fees
- **Full Trading**: Buy and sell YES/NO tokens with real-time price updates

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Wagmi, Viem
- **Smart Contracts**: Solidity 0.8.24, Foundry, OpenZeppelin
- **Chain**: BNB Smart Chain Testnet

## Project Structure

```
speculate-v3/
├── contracts/          # Smart contracts (DirectCore, MockUSDC, PositionToken, Treasury)
│   ├── src/
│   ├── script/
│   └── out/
├── frontend/           # Next.js frontend
│   ├── app/
│   ├── components/
│   └── lib/
└── README.md
```

## Smart Contracts

### DirectCore
Main market contract implementing direct USDC ↔ YES pricing:
- Markets start with 0 liquidity, just an initial price
- Buy: Pay USDC → Get tokens at current price → Price moves up
- Sell: Return tokens → Get USDC at current price → Price moves down
- Admin-configurable sensitivity (0.1% - 5%)

### MockUSDC
Test USDC token for BSC Testnet (6 decimals)

### PositionToken
YES/NO position tokens (18 decimals, mintable/burnable)

### Treasury
Fee collection contract (optional)

## Frontend Features

- **Home Page**: Market overview and stats
- **Markets Page**: Browse all markets with filters
- **Market Detail Page**: View market stats and trade
- **Admin Panel**: Create markets, manage sensitivity
- **Trading Interface**: Buy/sell with real-time estimates

## Getting Started

### Prerequisites
- Node.js 18+
- Foundry
- MetaMask or compatible wallet

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Contract Setup
```bash
cd contracts
forge install
forge build
```

### Environment Variables

Create `frontend/.env.local`:
```
NEXT_PUBLIC_CORE_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_ADMIN_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=97
```

Create `contracts/.env`:
```
PRIVATE_KEY=0x...
```

## Deployment

See `contracts/DEPLOY_GUIDE.md` for deployment instructions.

## License

MIT
