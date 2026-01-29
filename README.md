# Blockticity L1 Minting

🔺 Smart contracts and scripts for Blockticity’s Avalanche L1 — minting scalable, verifiable COAs for real-world assets

Blockticity LayerZero NFT minting for COAs — Trustless Trade at Scale

## Blockticity Contract Addresses

**Mainnet (Blockticity Avalanche L1)**  
- Address: `0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926`  
- Chain ID: 28530  
- RPC: https://subnets.avax.network/btic/mainnet/rpc

**Testnet - BTEST (Blockticity Avalanche L1 Testnet)**
- Address: `0x600D115075768548527BCcd156ccC921D7861f87`
- Chain ID: 75234
- RPC: https://subnets.avax.network/btest/testnet/rpc
- Note: Managed by AvaCloud

**Testnet - BTEST2 (Sovereign L1 - Full Validator Control)**
- Address: `0x72458e7a49dA8Ff516810c888c3c0afA1ab7CF55`
- Chain ID: 54928
- Token: BTEST2
- Subnet ID: `2ALKrTmpvnMJCXffpwrqAZvHWk6UzBtVuSfZDaCVf54m1MhvLB`
- Blockchain ID: `2GQaNqXA9RtrUgt5PT6Fo8QKFdoyQwLTA33L3zaz2Noa13Qwbc`
- RPC: Via SSH tunnel to validators (see below)
- Validators:
  - `NodeID-PqwugivTeb2qFGzsEcR9Tmth7PCjzopq2` (us-east-1)
  - `NodeID-CjNb6o7nxXYcy3SzzEy6rqqnVqDuvbUHw` (us-west-2)

## Environment Configuration

### Mainnet (.env)

```bash
MAINNET_CONTRACT=0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926
CONTRACT_ADDRESS=0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926
MAINNET_RPC_URL=https://subnets.avax.network/btic/mainnet/rpc
MAINNET_CHAIN_ID=28530
MAINNET_PRIVATE_KEY=your_mainnet_private_key
ONESOURCE_API_TOKEN=your_onesource_api_token
```

### BTEST2 Testnet (.env)

```bash
BTEST2_RPC_URL=http://127.0.0.1:9650/ext/bc/2GQaNqXA9RtrUgt5PT6Fo8QKFdoyQwLTA33L3zaz2Noa13Qwbc/rpc
BTEST2_CHAIN_ID=54928
BTEST2_CONTRACT=0x72458e7a49dA8Ff516810c888c3c0afA1ab7CF55
BTEST2_PRIVATE_KEY=your_btest2_private_key
```

### BTEST2 SSH Tunnel Setup

BTEST2 validators bind RPC to localhost. Use SSH tunnel for access:

```bash
# Connect to validator (us-east-1)
ssh -L 9650:127.0.0.1:9650 -i ~/blockticity-validator-node/blockticity-validator-key.pem ubuntu@35.153.114.85

# Then run hardhat commands
npx hardhat run scripts/deploy-btest2.js --network btest2
```

### BTEST2 Scripts

| Script | Description |
|--------|-------------|
| `scripts/deploy-btest2.js` | Deploy BlockticityLayerZeroV2 to BTEST2 |
| `scripts/test-mint-btest2.js` | Test single COA mint |
| `scripts/test-batch-mint-btest2.js` | Test batch mint (5 COAs) |
| `scripts/mint-gve-btest2.js` | Mint GVE certificates from pipeline output |

## OneSource API Integration

OneSource provides indexing and querying capabilities for COAs minted on Blockticity L1.

### Configuration

- **API Endpoint:** `https://blockticity.api.onesource.io/v1/avax-mainnet/graphql`
- **Production Contract:** `0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926`
- **Total Minted:** ~762,080 COAs (Wacker, Earl Campbell, ACS Lab, etc.)

### Usage

```javascript
const OneSourceAPI = require('./scripts/onesource-helper');
const api = new OneSourceAPI(process.env.ONESOURCE_API_TOKEN);

// Health check
const status = await api.healthCheck();

// Get token by ID
const token = await api.getToken('750000');

// Verify transaction was indexed
const tx = await api.verifyTransaction('0x...');

// Get latest tokens
const tokens = await api.getLatestTokens(10);

// Search by attribute
const results = await api.searchByAttribute('Client', 'Wacker');
```

### Available Methods

| Method | Description |
|--------|-------------|
| `healthCheck()` | Verify API connection and contract indexing |
| `getToken(tokenId)` | Get token details by ID |
| `getLatestTokens(limit)` | Get most recently minted tokens |
| `verifyTransaction(txHash)` | Check if transaction is indexed |
| `waitForTransaction(txHash)` | Poll until transaction is indexed |
| `verifyBatchMint(txHash, count)` | Verify batch mint transaction |
| `searchByAttribute(trait, value)` | Search tokens by metadata attribute |
| `getContractStats()` | Get contract statistics |
| `getRecentEvents(limit)` | Get recent contract events |

### Helper Script Location

```
blockticity-l1-minting/scripts/onesource-helper.js
```
