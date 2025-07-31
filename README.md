# Blockticity L1 Minting

Blockticity LayerZero NFT minting for COAs - Trustless Trade at Scale

## Blockticity Contract Addresses

**Mainnet (Blockticity Avalanche L1)**  
- Address: `0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926`  
- Chain ID: 28530  
- RPC: https://subnets.avax.network/btic/mainnet/rpc

**Testnet (Blockticity Avalanche L1 Testnet)**  
- Address: `0x600D115075768548527BCcd156ccC921D7861f87`  
- Chain ID: 75234  
- RPC: https://subnets.avax.network/btest/testnet/rpc

## Environment Configuration

### Mainnet (.env)
```bash
MAINNET_CONTRACT=0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926
CONTRACT_ADDRESS=0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926
MAINNET_RPC_URL=https://subnets.avax.network/btic/mainnet/rpc
MAINNET_CHAIN_ID=28530
MAINNET_PRIVATE_KEY=your_mainnet_private_key
```

### Testnet (.env.test)
```bash
TESTNET_CONTRACT=0x600D115075768548527BCcd156ccC921D7861f87
CONTRACT_ADDRESS=0x600D115075768548527BCcd156ccC921D7861f87
TESTNET_RPC_URL=https://subnets.avax.network/btest/testnet/rpc
TESTNET_CHAIN_ID=75234
PRIVATE_KEY=your_testnet_private_key
```

## Usage

### Setup
```bash
npm install
```

### Deploy to Testnet
```bash
npx hardhat run scripts/deploy.js --network blockticityTestnet
```

### Deploy to Mainnet
```bash
npx hardhat run scripts/deploy-mainnet.js --network blockticityMainnet
```

### Mint Single NFT
```bash
# Mainnet
npx hardhat run scripts/mintURI.js --network blockticityMainnet

# Testnet
npx hardhat run scripts/mintURI.js --network blockticityTestnet
```

### Batch Minting
```bash
node scripts/bulkMintFromCSV.js
```

### Verify Contract
```bash
npx hardhat run scripts/verify-deployment.js --network blockticityMainnet
```

## Project Structure

- `contracts/` - Smart contract source files
- `scripts/` - Deployment and minting scripts
- `placeholder-pia-test/` - Placeholder testing and batch minting
- `.env` - Mainnet configuration
- `.env.test` - Testnet configuration

## Features

- ERC-721 compliant NFTs
- LayerZero cross-chain compatibility
- Batch minting capabilities
- IPFS metadata storage
- ASTM D8558 compliant certificates

## Security

  **Important**: Never commit private keys to version control. Use environment variables for all sensitive configuration.