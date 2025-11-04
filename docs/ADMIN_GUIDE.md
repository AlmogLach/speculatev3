# Admin Guide

## Admin Panel Overview

Access the admin panel at `/admin` (wallet must match `NEXT_PUBLIC_ADMIN_ADDRESS`).

## Creating Markets

1. Click "Create Market" button
2. Fill in:
   - **Question**: Yes/No prediction (e.g., "Will BTC hit 100k in 2025?")
   - **Initial Liquidity**: USDC to seed pool (min 100 USDC)
   - **Expiry**: When market closes
   - **Fee Rate**: Default 1% (100 basis points)
3. Approve USDC spending (if not already)
4. Click "Create"
5. Market appears in list immediately

**Best Practices:**
- Minimum 1000 USDC liquidity for serious markets
- Clear, unambiguous questions
- Realistic expiry dates

## Managing Markets

### Pause Market

**Use case**: Bug discovered, need emergency stop

1. Find market in list
2. Click "Pause"
3. Trading stops immediately
4. Users can't buy/sell
5. Admin can still resolve

### Unpause Market

1. Find paused market
2. Click "Unpause"
3. Trading resumes

### Resolve Market

**After expiry** (and outcome is clear):

1. Find market in list
2. Click "Yes Wins" or "No Wins"
3. Market moves to Resolved state
4. Winners can now redeem 1:1

**Before expiry** (not recommended except emergencies):
- Can resolve early if needed
- Admin should be trusted

## System Settings

### Update Fee Rate

Change fee for specific market:
1. Select market
2. Set new fee (0-10%)
3. Click "Update"

### Withdraw Fees

Accumulated fees from all trades:
1. View "Total Fees" in dashboard
2. Click "Withdraw Fees"
3. USDC sent to admin wallet

**Note**: Fees accumulate in `totalFees` tracking variable
- Implement fee vault in production
- Admin can withdraw periodically

### Transfer Admin

**Security**: Transfer admin role to multisig or DAO

1. Enter new admin address
2. Click "Transfer Admin"
3. Old admin loses access immediately
4. New admin gains full control

## Emergency Procedures

### Stop All Trading

```solidity
// Pause each market individually
for (i = 1; i <= marketCount; i++) {
    pauseMarket(i);
}
```

### Withdraw All Fees

```solidity
withdrawFees(); // Transfers accumulated fees
```

### Upgrade Contracts

Current version doesn't support upgrades. For production:
- Implement Proxy pattern (UUPS or Transparent)
- Add upgrade function with timelock
- Migrate markets to new core

## Monitoring

### Key Metrics to Track

1. **Total Markets**: `marketCount()`
2. **Total Fees**: `totalFees()`
3. **Per Market**: `usdcVault`, `totalPairs` (should match!)
4. **Active Users**: Track via events

### Health Checks

```solidity
// Solvency check for market i
assert(markets[i].usdcVault == markets[i].totalPairs);

// If this ever fails, protocol is insolvent (shouldn't happen)
```

### Event Monitoring

Listen for:
- `MarketCreated` - New market
- `TradeBuy` / `TradeSell` - Volume tracking
- `PairRedeemed` - User cash-outs
- `MarketResolved` - Settlements

## Production Considerations

### Security

- [ ] Multi-sig admin (Gnosis Safe)
- [ ] Timelock on sensitive functions
- [ ] Bug bounty program
- [ ] Formal verification
- [ ] Audit before mainnet

### Operations

- [ ] Automated monitoring
- [ ] Alerting system
- [ ] Backup admins
- [ ] Emergency response plan
- [ ] Insurance fund

### Compliance

- [ ] Legal review
- [ ] Terms of service
- [ ] Privacy policy
- [ ] KYC/AML if needed
- [ ] Jurisdiction analysis

## Support

For technical issues:
- Check contract logs on BSCScan
- Verify state with `markets(id)` view
- Test on testnet first

For user disputes:
- Review on-chain transactions
- Check resolution timestamps
- Enforce terms of service


