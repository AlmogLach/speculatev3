# SpeculateCore Subgraph

Subgraph for indexing SpeculateCore contract events on BSC Testnet.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update `subgraph.yaml`:
   - Set the correct `address` for your deployed SpeculateCore contract
   - Set the `startBlock` to the deployment block

3. Generate code:
```bash
npm run codegen
```

4. Build:
```bash
npm run build
```

## Deploy

### The Graph Studio (Recommended)

1. Go to [The Graph Studio](https://thegraph.com/studio/)
2. Create a new subgraph
3. Get your deploy key
4. Authenticate:
```bash
graph auth --studio <YOUR_DEPLOY_KEY>
```
5. Deploy:
```bash
npm run deploy
```

### Hosted Service (Legacy)

```bash
graph auth --product hosted-service <YOUR_ACCESS_TOKEN>
npm run deploy:hosted
```

## Query URL

After deployment, you'll get a query URL like:
```
https://api.studio.thegraph.com/query/<SUBGRAPH_ID>/speculate-v3/version/latest
```

Add this to your frontend `.env.local`:
```
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/...
```

