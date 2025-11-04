# Environment Setup

## Create `.env` file

In the `contracts/` directory, create a `.env` file with:

```env
PRIVATE_KEY=your_deployer_private_key_without_0x_prefix
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=your_bscscan_api_key
```

### How to Get Values:

1. **PRIVATE_KEY**: Your deployer wallet's private key (without `0x` prefix)
   - Make sure it has testnet BNB for gas fees

2. **BSC_TESTNET_RPC_URL**: Public BSC Testnet RPC endpoint
   - Default: `https://data-seed-prebsc-1-s1.binance.org:8545`

3. **BSCSCAN_API_KEY**: Get from https://bscscan.com/myapikey
   - Free to sign up
   - Used for contract verification

## Security Note

**DO NOT commit `.env` to version control!**

The `.env` file is already in `.gitignore` to protect your private keys.


