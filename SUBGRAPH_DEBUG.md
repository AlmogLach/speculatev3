# Subgraph Debugging Guide

## Current Status
- **Subgraph Version**: v0.0.4
- **Start Block**: 70000000
- **Network**: chapel (BSC Testnet)
- **Contract Address**: 0x02344e92a5389D3cB0100844eE262CA10818aC6e
- **Query URL**: https://api.studio.thegraph.com/query/1704746/speculate-v-3/v0.0.4

## Test Queries

### Check Subgraph Sync Status
```graphql
{
  _meta {
    block {
      number
    }
    hasIndexingErrors
  }
}
```

### Query Markets
```graphql
{
  markets(first: 10) {
    id
    marketId
    question
    yesToken
    noToken
    createdAt
  }
}
```

### Query Trades
```graphql
{
  trades(first: 10) {
    id
    marketId
    type
    user
    timestamp
  }
}
```

## Possible Issues

1. **Contract Address Mismatch**: Verify the contract address is correct
2. **Network Mismatch**: Ensure network is "chapel" for BSC Testnet
3. **Event Signature Mismatch**: Check if MarketCreated event signature matches
4. **Start Block Too High**: If contract was deployed before block 70M, events won't be indexed

## Next Steps

1. Check The Graph Studio: https://thegraph.com/studio/subgraph/speculate-v-3
2. Look for indexing errors in the logs
3. Verify the contract address on BSC Testnet Explorer
4. Check if MarketCreated events are being emitted

