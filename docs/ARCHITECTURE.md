# SpeculateX v3 Architecture

## Core Design: Pure CPMM + Pair Redemption

SpeculateX v3 implements a **solvent prediction market** using constant product market making for price discovery and pair redemption for USDC cash-out.

## Mathematical Model

### Constant Product Formula

Every market maintains: `k = reserveYes × reserveNo`

**Price calculations:**
- `price_yes = reserveNo / (reserveYes + reserveNo)`
- `price_no = reserveYes / (reserveYes + reserveNo)`

**Trade output (buying YES with S tokens of opposite side):**
- `new_reserveNo = reserveNo + S`
- `new_reserveYes = k / new_reserveNo`
- `YES_out = reserveYes - new_reserveYes + S`

This is the standard Uniswap v1/v2 AMM formula.

### Solvency Invariant

**Critical rule**: `usdcVault = totalPairs` at all times

- `usdcVault`: USDC held by contract (6 decimals)
- `totalPairs`: Total YES+NO pairs minted (6 decimals when converted)

This ensures the vault can pay all pairs at 1:1 if everyone redeems.

## State Machine

```
Market Lifecycle:

CREATE → ACTIVE → PAUSED (optional) → RESOLVED

States:
- CREATE: Deploying, not yet tradeable
- ACTIVE: Full trading enabled (buy, sell, redeem)
- PAUSED: Trading suspended, admin can unpause
- RESOLVED: Expiry reached, admin declared winner
```

## Contract Functions

### SpeculateCore

**Market Management:**
- `createMarket()` - Admin creates new market
- `pauseMarket()` - Admin pauses trading
- `unpauseMarket()` - Admin resumes trading
- `resolveMarket()` - Admin sets winner

**Trading:**
- `buy(marketId, isYes, usdcIn)` - Buy YES or NO with USDC
- `sell(marketId, isYes, tokensIn)` - Sell to opposite token
- `redeemPairs(marketId, amount)` - Burn pairs for USDC
- `closePosition(marketId, yesIn, noIn)` - Convenience function

**Views:**
- `priceYesE18()` - Current YES price (scaled to 1e18)
- `priceNoE18()` - Current NO price (scaled to 1e18)
- `markets(id)` - Full market struct

**Admin:**
- `transferAdmin()` - Transfer admin role
- `updateFeeRate()` - Change market fee
- `withdrawFees()` - Withdraw accumulated fees

## Token Standards

### PositionToken (18 decimals)

- Name: "Question - YES" / "Question - NO"
- Symbol: "YES" / "NO"
- Mintable/burnable by SpeculateCore only
- Standard ERC20 otherwise

### MockUSDC (6 decimals)

- Standard ERC20
- Mintable for testing
- Transfer/approve standard

## Fee Structure

**Default**: 1% per trade (configurable per market)

Split on buy/sell:
- Deducted before CPMM swap
- Accumulated in `totalFees` (for admin withdrawal)

No fee on:
- `redeemPairs()` (redemption for backing)
- Price queries

## Security Considerations

### Reentrancy Protection

All state-changing functions use `nonReentrant` modifier.

### Overflow Protection

Solidity 0.8.24 with checked math (default safe).

### Access Control

- `onlyAdmin` - Market management
- `onlyActive` - Trade functions
- `onlyCore` - Token minting/burning

### Price Manipulation Resistance

CPMM formula naturally prevents:
- Flash loans (reentrancy protection)
- Sandwich attacks (no pending orders)
- Liquidity drainage (always 1:1 backed)

## Gas Optimization

- Minimal storage reads/writes
- No complex loops
- Efficient CPMM math
- Packed structs where possible

## Scalability

Each market is independent:
- No cross-market dependencies
- Parallel execution possible
- Linear gas growth with market count

## Future Enhancements

Potential additions:
- [ ] Liquidity incentives for market makers
- [ ] Partial resolution (multi-outcome)
- [ ] Oracle integration for automated resolution
- [ ] Governance token
- [ ] Fee sharing with LPs
- [ ] Market curation


