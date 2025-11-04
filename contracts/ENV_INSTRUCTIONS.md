# 🔐 Environment Setup Instructions

## Create `.env` File

You need to manually create a `.env` file in `speculate-v3/contracts/` directory.

### Windows PowerShell:

```powershell
cd c:\Users\Almog\Desktop\ksp\speculate-v3\contracts

# Create .env file
@"
PRIVATE_KEY=your_private_key_without_0x_prefix
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=your_bscscan_api_key_here
"@ | Out-File .env -Encoding utf8
```

### Then Edit `.env`:

Replace the placeholder values with your actual keys:

```env
PRIVATE_KEY=abc123... (your deployer wallet private key, NO 0x prefix)
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=ABC123... (get from https://bscscan.com/myapikey)
```

## What You Need:

1. **Private Key**: From MetaMask or your wallet
   - Export private key from wallet
   - Remove the `0x` prefix if present
   - Ensure wallet has testnet BNB for gas

2. **BSCScan API Key**: 
   - Go to https://bscscan.com/register
   - After login, go to https://bscscan.com/myapikey
   - Click "Add" to create a new API key
   - Free tier is fine for testnet

## ⚠️ Security Warning

**DO NOT share your private key!**

The `.env` file is already in `.gitignore` to protect it.

## Test Your Setup:

```powershell
cd c:\Users\Almog\Desktop\ksp\speculate-v3\contracts
.\deploy.bat
```

If you see errors about missing environment variables, check your `.env` file.


