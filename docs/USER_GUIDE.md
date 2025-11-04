# User Guide

## Getting Started

1. Connect your wallet (MetaMask, WalletConnect, etc.)
2. Get test USDC from faucet (BSC Testnet)
3. Navigate to Markets
4. Start trading!

## Trading Flows

### Scenario 1: Buy and Hold

**Goal**: Buy 100 YES tokens and hold until resolution

1. Go to market page
2. Click "Buy" tab
3. Select "YES"
4. Enter amount: 100 USDC
5. Click "Buy YES"
6. Approve transaction
7. Receive ~200 YES tokens (depending on price)

**Note**: Price moves up as you buy, so you get fewer tokens than at lower prices.

### Scenario 2: Close Position Early

**Goal**: Take profits before resolution

You have 150 YES + 150 NO tokens:

1. Go to Portfolio page
2. Select the market
3. Click "Close Position"
4. Approve transaction
5. Receive ~150 USDC (1:1 for pairs)

Or manually:
1. Sell 150 YES → receive NO
2. Now have: ~300 NO
3. Sell 150 NO → receive YES  
4. Now have: ~150 YES + ~150 NO
5. Redeem pairs → get USDC back

### Scenario 3: Take Partial Profit

**Goal**: Keep some position, cash out some USDC

You have 200 YES + 200 NO:

1. Use `closePosition(100, 100)` - closes half
2. Receive 100 USDC
3. Keep 100 YES + 100 NO for betting

## Understanding Prices

**Current Price**: Probability implied by CPMM reserves

- YES price = 0.70 means ~70% market thinks YES wins
- NO price = 0.30 means ~30% market thinks NO wins
- Prices always sum to 1.0

**Why prices change:**
- More YES buyers → YES price increases
- More NO buyers → NO price increases  
- Sells work in reverse

## Fees

**1% fee** on every buy/sell:
- Goes to protocol treasury
- Accumulated for admin withdrawal

**No fee** on:
- Closing positions (pair redemption)
- Price queries
- Just holding tokens

## Slippage

On large trades, price moves against you:

**Example**: Buying 1000 USDC of YES when pool has 1000 USDC
- First dollar: best price
- Last dollar: worst price
- Average: somewhere in middle

**Protection**: Frontend calculates estimated output
- Shows worst-case scenario
- You can reject if slippage too high

## After Resolution

**Winning side:**
1. Go to Portfolio
2. Click "Redeem Winners"
3. Get USDC 1:1 for winning tokens

**Losing side:**
- Tokens become worthless
- No redemption possible
- They're just burnt when you try

## FAQs

**Q: Why can't I sell for USDC directly?**
A: Solvency requires USDC to stay in vault until pairs are redeemed. Sells are CPMM swaps to opposite token.

**Q: What if nobody is trading?**
A: You can still buy! The pool is the counterparty. Market is always liquid.

**Q: Can prices go to 0 or 1?**
A: In theory yes, but CPMM asymptotes. 100% concentration is impossible.

**Q: What happens to fees?**
A: Accumulated in `totalFees`, admin can withdraw them.

**Q: Is this like Polymarket?**
A: Very similar! Main difference is pair redemption vs direct USDC sells.


