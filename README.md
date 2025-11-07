# 🧠 SpeculateX Protocol

**Dynamic prediction markets powered by Chainlink automation, boosted AMM math, and a polished Next.js UX.**

---

## 🌍 Live App

[https://speculatev3.vercel.app](https://speculatev3.vercel.app)


## 📦 Tech Stack

- Next.js 14, React, TypeScript, Tailwind CSS
- Wagmi + Viem for wallet connectivity
- Solidity 0.8.24 (Foundry toolchain)
- Chainlink Automation & Price Feeds
- BNB Smart Chain Testnet (Chain ID 97)


## ⚙️ Core Features

- Boosted constant-product AMM for YES/NO markets with slippage-aware trading
- Automated market resolution via Chainlink Automation + global price feeds
- Admin dashboard to create markets with configurable Chainlink parameters
- Auto-approval, recommended slippage, and full mobile-ready trading UI
- 2% buy fee split: 1% protocol, 0.5% LP, 0.5% back into pool (no sell fee by default)
- Real-time subgraph indexing for performance stats and dashboards


## 🔐 Smart Contracts (BSC Testnet)

- `SpeculateCore.sol` – boosted AMM, fee logic, Chainlink-aware market management
- `ChainlinkResolver.sol` – single upkeep that scans & resolves all markets
- `PositionToken.sol` – outcome tokens (YES/NO, ERC20-compatible)
- `Treasury.sol` – protocol fee vault (withdraw-only by owner)
- `MockUSDC.sol` – 6-decimal test token for local + testnet use

Latest deployments (Nov 2025):

| Contract | Address |
| --- | --- |
| SpeculateCore | `0x05d0e1Ab46c3e18610730ee36Aa767Df0D60Ae55` |
| ChainlinkResolver | `0x3a944a20c4fA46785B5FF6044F751D918e9DF31D` |
| Treasury | `0x242b6Cf7Ee87cb10Ea5cb157bF4fee4E39bC2AfA` |
| MockUSDC | `0x0E5cB1F812ce0402fdF0c9cee2E1FE3BF351a827` |


## 🛰️ Subgraph

- **Endpoint:** `https://api.studio.thegraph.com/query/1704746/speculate-v-3/v0.0.9`
- Indexes markets, trades, and liquidity stats for the entire protocol.


## 🚀 Quick Start

```bash
# Frontend
cd speculate-v3/frontend
npm install
npm run dev

# Contracts
cd speculate-v3/contracts
forge install
forge build
```

Environment variables:

```bash
# frontend/.env.local
NEXT_PUBLIC_CORE_ADDRESS=0x05d0e1Ab46c3e18610730ee36Aa767Df0D60Ae55
NEXT_PUBLIC_USDC_ADDRESS=0x0E5cB1F812ce0402fdF0c9cee2E1FE3BF351a827
NEXT_PUBLIC_ADMIN_ADDRESS=0xbd0e87A678f3D53a27D1bb186cfc8fd465433554
NEXT_PUBLIC_CHAINLINK_RESOLVER_ADDRESS=0x3a944a20c4fA46785B5FF6044F751D918e9DF31D
NEXT_PUBLIC_TREASURY_ADDRESS=0x242b6Cf7Ee87cb10Ea5cb157bF4fee4E39bC2AfA
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/1704746/speculate-v-3/v0.0.9
NEXT_PUBLIC_CHAIN_ID=97

# contracts/.env
PRIVATE_KEY=0x<testnet-deployer>
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
USDC_ADDRESS=0x0E5cB1F812ce0402fdF0c9cee2E1FE3BF351a827
TREASURY_ADDRESS=0x242b6Cf7Ee87cb10Ea5cb157bF4fee4E39bC2AfA
```


## 🧪 Key Workflows

- `DeployCoreOnly.s.sol` — redeploys SpeculateCore
- `DeployTreasury.s.sol` + `SetTreasury.s.sol` — fee vault setup
- `SetupGlobalFeeds.s.sol` — registers Chainlink price feeds in the resolver
- `SpeculateCoreRoundTrip.t.sol` — Forge test covering buy→sell round trips


## 👨‍👨‍👧‍👦 Team

- **Almog Lachiany** — Solidity + Frontend + Product
- Contributions welcome: open an issue or PR in this repo.


## 📜 License

MIT
