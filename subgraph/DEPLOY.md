# Deploying the SpeculateCore Subgraph

This guide will help you deploy the subgraph to The Graph Studio (free tier).

## Prerequisites

1. A GitHub account
2. Node.js installed (v16+)
3. The Graph CLI installed:
   ```bash
   npm install -g @graphprotocol/graph-cli
   ```

## Step 1: Update Configuration

Edit `subgraph.yaml` and update:
- `address`: Your deployed SpeculateCore contract address
- `startBlock`: The block number when the contract was deployed (important for fast syncing)

## Step 2: Install Dependencies

```bash
cd speculate-v3/subgraph
npm install
```

## Step 3: Generate Code

```bash
npm run codegen
```

This generates TypeScript types from your schema and ABIs.

## Step 4: Build the Subgraph

```bash
npm run build
```

## Step 5: Create Subgraph in The Graph Studio

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Sign in with GitHub
3. Click "Create a Subgraph"
4. Name it (e.g., "speculate-v3")
5. Copy the deploy command (e.g., `graph auth --studio <YOUR_DEPLOY_KEY>`)

## Step 6: Authenticate

Run the auth command from Step 5:
```bash
graph auth --studio <YOUR_DEPLOY_KEY>
```

## Step 7: Deploy

```bash
npm run deploy
```

Or directly:
```bash
graph deploy --studio speculate-v3
```

## Step 8: Get Query URL

After deployment, The Graph Studio will provide a query URL like:
```
https://api.studio.thegraph.com/query/<SUBGRAPH_ID>/speculate-v3/version/latest
```

## Step 9: Add to Frontend

Add this to your `speculate-v3/frontend/.env.local`:
```
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<SUBGRAPH_ID>/speculate-v3/version/latest
```

## Step 10: Wait for Sync

The subgraph will start indexing from the `startBlock`. You can monitor progress in The Graph Studio.

## Troubleshooting

- **"Subgraph not syncing"**: Check that the contract address and startBlock are correct
- **"No data returned"**: Wait for sync to complete, or check that events are being emitted
- **"Schema errors"**: Run `npm run codegen` again after fixing schema.graphql

## Benefits of Using Subgraph

✅ No RPC rate limits  
✅ Fast queries (indexed data)  
✅ Historical data queries  
✅ Complex GraphQL queries  
✅ Free tier available  

