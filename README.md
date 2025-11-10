# SpeculateX

<div align="center">

**Trade on anything. Bet on everything.**

The future of prediction markets is here.

[Launch App](https://speculatex.app) • [Documentation](https://docs.speculatex.app) • [Twitter](https://twitter.com/speculatex)

</div>

---

## What is SpeculateX?

SpeculateX is a **decentralized prediction market platform** where you can trade on the outcome of real-world events. Will Bitcoin hit $100k? Will ETH reach $5k? Create a market, take a position, and profit from being right.

Unlike traditional betting platforms, SpeculateX uses sophisticated bonding curves and automated oracles to create liquid, efficient markets that settle instantly when events resolve.

### Why SpeculateX?

**🎯 Trade on Anything**  
From crypto prices to sports outcomes, economic indicators to political events - if it can be measured, you can trade it.

**⚡ Instant Liquidity**  
No waiting for counterparties. Our automated market maker provides instant execution at transparent prices.

**🤖 Automated Settlement**  
Chainlink oracles automatically resolve markets based on real-world data. No disputes, no delays.

**💰 Earn as You Trade**  
Provide liquidity to markets and earn fees from every trade. The more active the market, the more you earn.

**🔒 Fully Decentralized**  
Your funds, your custody. Smart contracts handle everything - no central authority can freeze or seize your assets.

---

## How It Works

### For Traders

**1. Find a Market**  
Browse active markets on crypto prices, sports, politics, or any measurable event.

**2. Buy Outcome Tokens**  
Think BTC will hit $100k? Buy YES tokens. Think it won't? Buy NO tokens. Prices reflect the market's probability.

**3. Watch Your Position**  
As traders buy and sell, prices update in real-time based on market sentiment.

**4. Collect Your Winnings**  
When the market resolves, winning tokens are redeemable 1:1 for USDC. Wrong predictions are worth $0.

**Example:**
- Market: "Will BTC hit $100k by Dec 2025?"
- You buy 100 YES tokens for $55 (55% probability)
- BTC hits $100k → Market resolves YES
- You redeem 100 tokens for $100 → **$45 profit (82% ROI)**

### For Liquidity Providers

**Earn passive income** by providing liquidity to markets:

- Deposit USDC to any market
- Earn 1% fee on every trade
- Claim fees anytime
- Receive leftover funds after market resolves

**No impermanent loss.** Your capital backs the market and earns consistently from trading activity.

### For Market Creators

Got an idea for a market? Create it:

1. Define your question
2. Choose an oracle (for automated resolution)
3. Add initial liquidity
4. Market goes live instantly

Markets can be about anything with verifiable outcomes: crypto prices, election results, sports scores, economic data, and more.

---

## Platform Features

### Advanced Market Making

Our proprietary bonding curve algorithm ensures:
- **Deep liquidity** at all price levels
- **Fair pricing** based on supply and demand
- **Instant execution** with transparent slippage
- **Protected markets** with anti-manipulation safeguards

### Oracle Integration

Markets can resolve automatically using real-world data:
- **Crypto prices** (BTC, ETH, BNB, and more)
- **Sports scores** (coming soon)
- **Economic indicators** (coming soon)
- **Custom data sources** (via Chainlink)

No disputes, no manual verification - outcomes settle automatically when oracles confirm the result.

### Security First

- **Smart contract audited** (audit in progress)
- **Non-custodial** - you control your funds
- **Guaranteed payouts** - mathematical solvency enforced
- **Reentrancy protected** - industry-standard security
- **Battle-tested** infrastructure on BNB Smart Chain

---

## 📊 Market Mechanics Deep Dive

### LMSR (Logarithmic Market Scoring Rule)

Unlike traditional order books or constant product AMMs, LMSR provides:
- **Infinite liquidity** at any price point
- **Bounded loss** for liquidity providers
- **Price elasticity** that adjusts with market depth
- **Mathematical guarantees** on maximum loss

**The Math:**
```
Cost Function: C(qY, qN) = max(qY, qN) + b * ln(1 + exp(|qY - qN| / b))

Where:
- qY, qN = quantity of YES/NO shares outstanding
- b = liquidity parameter (higher b = more liquidity, slower price movement)
- b = (initialUSDC × liquidityMultiplier × 1e18) / ln(2)

Price Calculation:
p(YES) = exp((qY - qN) / b) / (1 + exp((qY - qN) / b))
p(NO) = 1 - p(YES)
```

**Trading Flow:**

**Buying YES** (100 USDC):
```
1. Deduct fees: 2% (1% treasury + 1% LP)
   → Net: 98 USDC

2. Calculate shares using LMSR cost function:
   ΔqY such that: C(qY + ΔqY, qN) - C(qY, qN) = 98 USD
   
   Implementation: Binary search (40 iterations) to find ΔqY

3. Safety checks:
   ✓ Price jump < 15% (if vault < $10k threshold)
   ✓ Backing: vault ≥ max(qY + ΔqY, qN) × $1
   ✓ Slippage: ΔqY ≥ minOut

4. Execute:
   → Mint ΔqY YES tokens to user
   → Update qY += ΔqY
   → Add 98 USDC to vault
```

**Selling YES** (100 tokens):
```
1. Calculate refund:
   refund = C(qY, qN) - C(qY - 100, qN)

2. Convert to USDC (E18 → E6)

3. Safety checks:
   ✓ Price jump < 15% (if vault < threshold)
   ✓ Backing: vault - refund ≥ max(qY - 100, qN) × $1
   ✓ Minimum: refund ≥ minOut

4. Execute:
   → Burn 100 YES tokens
   → Update qY -= 100
   → Send refund USDC to user
```

### Fee Structure

| Action | Fee | Beneficiary |
|--------|-----|-------------|
| Buy YES/NO | 1% | Treasury (protocol revenue) |
| Buy YES/NO | 1% | Liquidity Providers |
| Sell YES/NO | 0% | No fee |
| Redeem Pairs | 0% | No fee |
| Winner Redemption | 0% | No fee |

**Why no sell fee?**
- Encourages exit liquidity
- Better price discovery
- Attracts more traders
- LPs still profit from buy side

### Resolution System

**Automated (Chainlink):**
```solidity
// Example: "Will BTC hit $100k by Dec 2025?"
Market {
    oracleType: ChainlinkFeed
    oracleAddress: 0xBTC_USD_Feed
    priceFeedId: keccak256("BTC/USD")
    targetValue: 100,000 * 1e8  // 8 decimals
    comparison: Above
    expiryTimestamp: 1735689600  // Dec 31, 2025 23:59:59 UTC
}

// At expiry, Chainlink Automation:
1. Fetches: (roundId, price, startedAt, timeStamp, answeredInRound)
2. Validates: timeStamp < 1 hour old, answeredInRound >= roundId
3. Compares: if (price > 100,000 * 1e8) → YES wins
4. Resolves: market.status = Resolved, market.yesWins = true
```

**Manual (Admin Override):**
- Admin can resolve any market manually
- Useful for non-oracle markets or edge cases
- Requires DEFAULT_ADMIN_ROLE

---

## 🔐 Security & Guarantees

### Smart Contract Security

✅ **Reentrancy Protection** - All state-changing functions use `nonReentrant` modifier  
✅ **Access Control** - Role-based permissions (DEFAULT_ADMIN_ROLE, MARKET_CREATOR_ROLE)  
✅ **Overflow Protection** - Solidity 0.8.24 built-in checks  
✅ **Solvency Invariants** - Mathematical backing enforced on every trade  
✅ **Stale Data Prevention** - 1-hour freshness check on oracle data  
✅ **Explicit Conversions** - Safe E6 ↔ E18 decimal conversions  

### Economic Security

- **Backing Formula**: `vault ≥ max(qYes, qNo) × $1`
  - Worst case: all shares on winning side get $1 each
  - Vault always has enough USDC to pay all winners
  - No fractional reserve, no undercollateralization

- **Jump Caps**: Prevent manipulation
  - Activates when vault < $10k (configurable per market)
  - Default: 15% max price change per tx
  - Can be set per market by admin

- **LP Protection**: 
  - Bounded loss via LMSR (max loss = b × ln(2))
  - Fee accrual via debt accounting (prevents gaming)
  - Residual distribution after resolution

### Oracle Security

- **Multiple validation layers**:
  ```solidity
  require(price > 0, "invalid price");
  require(timeStamp > 0, "round not complete");
  require(answeredInRound >= roundID, "stale data");
  require(block.timestamp - timeStamp < 1 hours, "stale data");
  ```

- **Global feed registry**:
  - Admin registers oracle feeds once
  - Markets reference by feedId (e.g., keccak256("BTC/USD"))
  - Update feed address without touching markets

---

## 📦 Deployment & Setup

### Prerequisites

- Node.js 18+ and npm
- Foundry (for contracts)
- MetaMask or compatible wallet
- BSC Testnet BNB for gas

### Smart Contracts

```bash
# Clone repository
git clone https://github.com/yourusername/speculatex.git
cd speculatex/contracts

# Install dependencies
forge install

# Compile contracts
forge build

# Run tests
forge test

# Deploy to BSC Testnet
forge script script/Deploy.s.sol:DeployScript --rpc-url $BSC_TESTNET_RPC_URL --broadcast --verify
```

**Environment Variables** (`contracts/.env`):
```bash
PRIVATE_KEY=0x...                        # Deployer private key
BSC_TESTNET_RPC_URL=https://...          # BSC Testnet RPC
USDC_ADDRESS=0x...                       # MockUSDC address
TREASURY_ADDRESS=0x...                   # Treasury address
SUPABASE_URL=https://...                 # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...            # Supabase service role key
```

### Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

**Environment Variables** (`frontend/.env.local`):
```bash
# Contract Addresses (BSC Testnet)
NEXT_PUBLIC_CORE_ADDRESS=0x312463901aDBB2C69843046bB04153454021318e
NEXT_PUBLIC_USDC_ADDRESS=0x2f7e29C9253bD5e096C5AFfa1827B843c536d031
NEXT_PUBLIC_ADMIN_ADDRESS=0xbd0e87A678f3D53a27D1bb186cfc8fd465433554
NEXT_PUBLIC_CHAINLINK_RESOLVER_ADDRESS=0xEf281d31444D89eEf9Eb133B9d163d7dB4026307
NEXT_PUBLIC_TREASURY_ADDRESS=0x242b6Cf7Ee87cb10Ea5cb157bF4fee4E39bC2AfA

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=97
NEXT_PUBLIC_RPC_URL=https://bsc-testnet.core.chainstack.com/
NEXT_PUBLIC_RPC_WS_URL=wss://bsc-testnet.core.chainstack.com/

# Supabase (Off-Chain Data)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
```

### Chainlink Automation Setup

1. **Register Global Price Feeds:**
   ```solidity
   // Connect to ChainlinkResolver: 0xEf281d31444D89eEf9Eb133B9d163d7dB4026307
   
   resolver.setGlobalFeed(
       keccak256("BTC/USD"),
       0x5741306c21795FdCBb9b265Ea0255F499DFe515C  // BSC Testnet BTC/USD
   );
   
   resolver.setGlobalFeed(
       keccak256("ETH/USD"),
       0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7  // BSC Testnet ETH/USD
   );
   
   resolver.setGlobalFeed(
       keccak256("BNB/USD"),
       0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526  // BSC Testnet BNB/USD
   );
   ```
   
   Find more feeds: [Chainlink BSC Testnet Feeds](https://docs.chain.link/data-feeds/price-feeds/addresses?network=bsc-testnet)

2. **Create Chainlink Upkeep:**
   - Go to: https://automation.chain.link/new-time-based
   - Contract: `0xEf281d31444D89eEf9Eb133B9d163d7dB4026307`
   - Function: `checkUpkeep`
   - checkData: Leave empty (or encode starting index)
   - Interval: 3600 seconds (1 hour)
   - Fund with LINK tokens

3. **Create Markets:**
   - Markets automatically connect to registered feeds
   - Select feed symbol (BTC/USD, ETH/USD, BNB/USD)
   - Set target value and comparison
   - Markets resolve automatically at expiry!

---

## 🎮 Usage Examples

### Creating a Market (Admin)

```typescript
// From admin panel: /admin

const market = {
  question: "Will BTC hit $100k by Dec 2025?",
  yesName: "BTC 100k YES",
  yesSymbol: "YES",
  noName: "BTC 100k NO", 
  noSymbol: "NO",
  initUsdc: 1000e6,                           // 1000 USDC initial liquidity
  expiryTimestamp: 1735689600,                // Dec 31, 2025 23:59:59 UTC
  oracle: "0x5741306c21795FdCBb9b265Ea0255F499DFe515C", // BTC/USD feed
  priceFeedId: keccak256("BTC/USD"),
  targetValue: 100_000 * 1e8,                 // $100k (8 decimals)
  comparison: 0                               // 0 = Above, 1 = Below, 2 = Equals
};

// Smart contract creates:
// - 2 new ERC20 tokens (YES + NO)
// - LMSR market with b = 1000 * 1e18 / ln(2)
// - Resolution config linked to BTC/USD feed
// - Market ID returned, instantly tradeable
```

### Trading

```typescript
// Buy YES tokens (from market page: /markets/1)

// User input: 100 USDC
const usdcIn = 100e6;  // 100 USDC (6 decimals)

// Calculate expected shares (frontend estimation)
const netAfterFees = usdcIn * 0.98;  // 2% fee
const expectedShares = calculateLMSROutput(qYes, qNo, b, netAfterFees);

// Set slippage tolerance (0.5%)
const minOut = expectedShares * 0.995;

// Execute trade
await core.buyYes(marketId, usdcIn, minOut);

// Result:
// ✓ User receives ~X YES tokens (depends on current price)
// ✓ Price of YES increases
// ✓ Price of NO decreases  
// ✓ qYes increases by X
// ✓ Vault increases by 98 USDC (after fees)
```

### Redeeming Winners

```typescript
// After market resolves YES (from claim page: /claim)

// User holds 500 YES tokens
const yesBalance = await yesToken.balanceOf(userAddress);  // 500e18

// Redeem 1:1 for USDC
await core.redeem(marketId, true);  // true = redeem YES tokens

// Result:
// ✓ Burns 500 YES tokens
// ✓ Sends 500 USDC to user (500e6)
// ✓ User made profit/loss based on purchase price
```

### LP Operations

```typescript
// Add liquidity (from admin page: /admin)

const addAmount = 5000e6;  // 5000 USDC

// Approve USDC
await usdc.approve(coreAddress, addAmount);

// Add liquidity
await core.addLiquidity(marketId, addAmount);

// Result:
// ✓ User receives 5000 shares
// ✓ Vault increases by 5000 USDC
// ✓ b (liquidity parameter) recalculates
// ✓ Fee debt initialized to prevent retroactive claims

// Claim fees anytime
const pending = await core.pendingLpFees(marketId, userAddress);
await core.claimLpFees(marketId);  // Claim accumulated fees

// After resolution, claim residual
await core.claimLpResidual(marketId);  // Claim leftover vault USDC
```

---

## 📈 Deployed Contracts (BSC Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **SpeculateCore** | [`0x312463901aDBB2C69843046bB04153454021318e`](https://testnet.bscscan.com/address/0x312463901aDBB2C69843046bB04153454021318e) | Main protocol logic (LMSR, trading, resolution) |
| **ChainlinkResolver** | [`0xEf281d31444D89eEf9Eb133B9d163d7dB4026307`](https://testnet.bscscan.com/address/0xEf281d31444D89eEf9Eb133B9d163d7dB4026307) | Automated oracle resolution |
| **Treasury** | [`0x242b6Cf7Ee87cb10Ea5cb157bF4fee4E39bC2AfA`](https://testnet.bscscan.com/address/0x242b6Cf7Ee87cb10Ea5cb157bF4fee4E39bC2AfA) | Protocol fee collection |
| **MockUSDC** | [`0x2f7e29C9253bD5e096C5AFfa1827B843c536d031`](https://testnet.bscscan.com/address/0x2f7e29C9253bD5e096C5AFfa1827B843c536d031) | Test collateral token |

**Verify on BscScan:**
```bash
forge verify-contract <ADDRESS> <CONTRACT> \
  --chain-id 97 \
  --etherscan-api-key <YOUR_API_KEY>
```

---

## 📚 Documentation

Comprehensive guides available in [`/docs`](./docs):

- 📖 [**Architecture**](./docs/ARCHITECTURE.md) - Deep dive into LMSR mechanics, contract design
- 👤 [**User Guide**](./docs/USER_GUIDE.md) - How to trade, create positions, redeem winners
- 👑 [**Admin Guide**](./docs/ADMIN_GUIDE.md) - Market creation, fee management, oracle setup
- 🚀 [**Deployment**](./docs/DEPLOYMENT.md) - Step-by-step deployment instructions
- 🔬 [**Testing**](./docs/TESTING.md) - Test suite overview, coverage reports

### Key Files

```
speculatev1/
├── contracts/                        # Foundry project
│   ├── src/
│   │   ├── SpeculateCore.sol        # Main protocol (1050+ lines)
│   │   ├── ChainlinkResolver.sol    # Auto-resolution system
│   │   ├── PositionToken.sol        # YES/NO ERC20 tokens
│   │   ├── Treasury.sol             # Fee vault
│   │   └── MockUSDC.sol             # Test collateral
│   ├── script/                      # Deployment scripts
│   ├── test/                        # Foundry tests
│   └── foundry.toml                 # Build configuration
│
├── frontend/                        # Next.js 15 application
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   ├── markets/                 # Market list & detail
│   │   ├── admin/                   # Admin panel
│   │   ├── portfolio/               # User positions
│   │   └── claim/                   # Winner redemption
│   ├── components/
│   │   ├── TradingCard.tsx          # Buy/sell interface
│   │   ├── PriceChart.tsx           # Price history charts
│   │   ├── CreateMarketForm.tsx     # Market creation
│   │   └── Header.tsx               # Navigation
│   └── lib/
│       ├── hooks.ts                 # Contract interaction hooks
│       ├── contracts.ts             # Contract addresses & ABIs
│       └── priceHistory/            # Chart data management
│
├── docs/                            # Documentation
│   ├── ARCHITECTURE.md              # Technical design
│   ├── USER_GUIDE.md                # Trading guide
│   ├── ADMIN_GUIDE.md               # Admin operations
│   └── DEPLOYMENT.md                # Deployment guide
│
└── README.md                        # This file
```

---

## 🧪 Testing

### Smart Contract Tests

```bash
cd contracts

# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test
forge test --match-test testBuyYes

# Gas report
forge test --gas-report

# Coverage
forge coverage
```

**Test Suite:**
- ✅ LMSR math verification (logarithms, exponentials)
- ✅ Buy/sell round trips (price consistency)
- ✅ Solvency invariants (backing checks)
- ✅ Fee distribution (LP accounting)
- ✅ Resolution flows (Chainlink + manual)
- ✅ Access control (role-based permissions)
- ✅ Edge cases (dust amounts, max values)

### Frontend Tests (Coming Soon)

```bash
cd frontend

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

---

## 🛣️ Roadmap

### ✅ Phase 1: Core Protocol (COMPLETE)
- [x] LMSR pricing engine with on-chain math
- [x] Position token system (YES/NO ERC20s)
- [x] Solvency enforcement & backing checks
- [x] LP system with fee distribution
- [x] Jump caps for price protection
- [x] Chainlink oracle integration
- [x] Automated resolution system

### ✅ Phase 2: Frontend & UX (COMPLETE)
- [x] Next.js 15 application
- [x] Trading interface with LMSR calculations
- [x] Price history charts (TradingView-style)
- [x] Portfolio tracking
- [x] Admin panel for market creation
- [x] Mobile-responsive design
- [x] Supabase integration for off-chain data

### 🔄 Phase 3: Security & Testing (IN PROGRESS)
- [ ] Comprehensive test suite (80%+ coverage)
- [ ] Fuzz testing for LMSR edge cases
- [ ] Invariant testing for solvency
- [ ] Gas optimization
- [ ] External security audit
- [ ] Bug bounty program

### 🔮 Phase 4: Mainnet Launch (Q2 2025)
- [ ] Deploy to BSC Mainnet
- [ ] Multi-chain support (Ethereum, Polygon, Arbitrum)
- [ ] Governance token (SPEC)
- [ ] DAO formation for protocol management
- [ ] Advanced market types (scalar, categorical)
- [ ] AMM liquidity mining incentives

### 🌟 Phase 5: Advanced Features (Q3-Q4 2025)
- [ ] Limit orders
- [ ] Market pools (bundle related markets)
- [ ] Social features (comments, follows, reputation)
- [ ] Portfolio management tools
- [ ] Trading API for bots
- [ ] Mobile app (iOS/Android)
- [ ] Integration with Chainlink Functions for custom data

---

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, feature additions, or documentation improvements.

### How to Contribute

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/speculatex.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation

4. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**
   - Describe your changes
   - Reference any related issues
   - Wait for review

### Development Guidelines

- **Smart Contracts**: Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- **Frontend**: Use TypeScript strict mode, ESLint rules
- **Testing**: Aim for >80% coverage on new code
- **Documentation**: Update README and docs/ for significant changes

### Areas We Need Help

- 🔐 Security auditing
- 🧪 Test coverage expansion
- 📱 Mobile optimization
- 🌍 Internationalization
- 📊 Analytics dashboard
- 🎨 UI/UX improvements

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

```
MIT License

Copyright (c) 2025 SpeculateX

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 👥 Team

**Almog Lachiany** - Founder & Lead Developer  
- 🔗 [GitHub](https://github.com/almog)  
- 🐦 [Twitter](https://twitter.com/almog)  
- 💼 [LinkedIn](https://linkedin.com/in/almog)

### Acknowledgments

- **Chainlink** - Oracle infrastructure
- **Binance** - BSC Testnet support
- **OpenZeppelin** - Smart contract libraries
- **Polymarket** - Inspiration for UX/design
- **Uniswap** - AMM mechanics reference

---

## 📞 Support & Community

- 💬 [Discord](https://discord.gg/speculatex) - Community chat
- 🐦 [Twitter](https://twitter.com/speculatex) - Updates & announcements
- 📧 [Email](mailto:support@speculatex.app) - Direct support
- 📝 [Blog](https://blog.speculatex.app) - Deep dives & tutorials
- 🐛 [GitHub Issues](https://github.com/yourusername/speculatex/issues) - Bug reports

---

## ⚠️ Disclaimer

**IMPORTANT:** SpeculateX is experimental software currently deployed on BSC Testnet for testing purposes only.

- ❌ Do NOT use with real funds
- ❌ Not audited for production use
- ❌ May contain bugs or vulnerabilities
- ❌ Smart contracts may be upgraded without notice

**Use at your own risk.** The developers assume no liability for any losses incurred.

---

## 🌟 Star History

If you find this project useful, please consider giving it a ⭐!

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/speculatex&type=Date)](https://star-history.com/#yourusername/speculatex&Date)

---

<div align="center">

**Built with ❤️ by the SpeculateX Team**

[Website](https://speculatex.app) • [Docs](./docs) • [Discord](https://discord.gg/speculatex) • [Twitter](https://twitter.com/speculatex)

</div>
