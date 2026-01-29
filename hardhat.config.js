require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Testnet configuration (BTEST - Original)
    blockticityTestnet: {
      url: process.env.TESTNET_RPC_URL || process.env.RPC_URL || "https://subnets.avax.network/btest/testnet/rpc",
      chainId: 75234,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // BTEST2 - Sovereign L1 Testnet (Full Control)
    btest2: {
      url: process.env.BTEST2_RPC_URL || "http://127.0.0.1:9650/ext/bc/2GQaNqXA9RtrUgt5PT6Fo8QKFdoyQwLTA33L3zaz2Noa13Qwbc/rpc",
      chainId: 54928,
      accounts: process.env.BTEST2_PRIVATE_KEY ? [process.env.BTEST2_PRIVATE_KEY] : (process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []),
      gasPrice: "auto",
      gas: "auto",
      timeout: 120000,
    },
    // Blockticity L1 Mainnet configuration
    blockticityMainnet: {
      url: process.env.MAINNET_RPC_URL || "https://subnets.avax.network/btic/mainnet/rpc",
      chainId: 28530,
      accounts: process.env.MAINNET_PRIVATE_KEY ? [process.env.MAINNET_PRIVATE_KEY] : [],
      gasPrice: "auto",
      gas: "auto",
      timeout: 120000,
    },
  },
  etherscan: {
    apiKey: {
      blockticityMainnet: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "blockticityMainnet",
        chainId: 28530,
        urls: {
          apiURL: "https://subnets.avax.network/btic/mainnet/explorer/api",
          browserURL: "https://subnets.avax.network/btic"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    token: "BTIC",
  },
};
