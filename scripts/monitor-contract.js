const { ethers } = require("hardhat");
const axios = require("axios");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

class ContractMonitor {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.contract = null;
    this.lastTokenId = 0;
    this.metrics = {
      totalMinted: 0,
      mintRate: 0,
      gasUsed: 0n,
      uniqueRecipients: new Set(),
    };
    this.checkInterval = 60000; // 1 minute
  }

  async initialize() {
    console.log(`${colors.cyan}Initializing contract monitor...${colors.reset}`);
    
    const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
    this.contract = BlockticityLayerZero.attach(this.contractAddress);
    
    // Get initial state
    this.lastTokenId = await this.contract.currentTokenId();
    this.metrics.totalMinted = Number(this.lastTokenId);
    
    console.log(`Contract: ${this.contractAddress}`);
    console.log(`Current Token ID: ${this.lastTokenId}`);
    
    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for Transfer events (minting)
    this.contract.on("Transfer", async (from, to, tokenId, event) => {
      if (from === ethers.ZeroAddress) {
        // This is a mint event
        console.log(`\n${colors.green}New COA Minted!${colors.reset}`);
        console.log(`Token ID: ${tokenId}`);
        console.log(`Recipient: ${to}`);
        console.log(`Transaction: ${event.log.transactionHash}`);
        
        this.metrics.totalMinted++;
        this.metrics.uniqueRecipients.add(to.toLowerCase());
        
        // Get gas used
        const receipt = await event.log.getTransactionReceipt();
        this.metrics.gasUsed += receipt.gasUsed;
        
        // Send alert for significant milestones
        if (this.metrics.totalMinted % 1000 === 0) {
          await this.sendAlert(
            `Milestone reached: ${this.metrics.totalMinted} COAs minted!`,
            "milestone"
          );
        }
      }
    });
    
    // Listen for ownership changes
    this.contract.on("OwnershipTransferred", (previousOwner, newOwner, event) => {
      console.log(`\n${colors.yellow}⚠️  Ownership Changed!${colors.reset}`);
      console.log(`Previous Owner: ${previousOwner}`);
      console.log(`New Owner: ${newOwner}`);
      console.log(`Transaction: ${event.log.transactionHash}`);
      
      this.sendAlert(
        `Contract ownership transferred from ${previousOwner} to ${newOwner}`,
        "critical"
      );
    });
  }

  async checkMetrics() {
    try {
      const currentTokenId = await this.contract.currentTokenId();
      const newMints = Number(currentTokenId) - Number(this.lastTokenId);
      
      if (newMints > 0) {
        const timeElapsed = this.checkInterval / 1000 / 60; // minutes
        this.metrics.mintRate = newMints / timeElapsed;
        
        console.log(`\n${colors.cyan}Metrics Update:${colors.reset}`);
        console.log(`New mints: ${newMints}`);
        console.log(`Mint rate: ${this.metrics.mintRate.toFixed(2)} COAs/minute`);
        console.log(`Total minted: ${currentTokenId}`);
        console.log(`Unique recipients: ${this.metrics.uniqueRecipients.size}`);
        
        this.lastTokenId = currentTokenId;
      }
      
      // Check contract health
      await this.checkContractHealth();
      
    } catch (error) {
      console.error(`${colors.red}Metrics check failed:${colors.reset}`, error.message);
      await this.sendAlert(`Metrics check failed: ${error.message}`, "error");
    }
  }

  async checkContractHealth() {
    try {
      // Check if contract is responsive
      await this.contract.name();
      
      // Check owner
      const owner = await this.contract.owner();
      
      // Check if paused (if pausable)
      if (this.contract.paused) {
        const isPaused = await this.contract.paused();
        if (isPaused) {
          console.log(`${colors.yellow}⚠️  Contract is paused${colors.reset}`);
          await this.sendAlert("Contract is currently paused", "warning");
        }
      }
      
      // Check gas price
      const feeData = await ethers.provider.getFeeData();
      const gasPriceGwei = Number(ethers.formatUnits(feeData.gasPrice, "gwei"));
      
      if (gasPriceGwei > 100) {
        console.log(`${colors.yellow}High gas price: ${gasPriceGwei} gwei${colors.reset}`);
      }
      
    } catch (error) {
      console.error(`${colors.red}Health check failed:${colors.reset}`, error.message);
      await this.sendAlert(`Health check failed: ${error.message}`, "critical");
    }
  }

  async generateDailyReport() {
    console.log(`\n${colors.bright}${colors.blue}Daily Report${colors.reset}`);
    console.log("=" .repeat(50));
    console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
    console.log(`Contract: ${this.contractAddress}`);
    console.log(`\nMetrics:`);
    console.log(`- Total COAs Minted: ${this.metrics.totalMinted}`);
    console.log(`- Unique Recipients: ${this.metrics.uniqueRecipients.size}`);
    console.log(`- Average Mint Rate: ${this.metrics.mintRate.toFixed(2)} COAs/minute`);
    console.log(`- Total Gas Used: ${ethers.formatUnits(this.metrics.gasUsed, "ether")} ETH`);
    
    // Calculate progress towards 750k goal
    const goalProgress = (this.metrics.totalMinted / 750000 * 100).toFixed(2);
    console.log(`\nProgress to 750k Goal: ${goalProgress}%`);
    
    // Estimate completion
    if (this.metrics.mintRate > 0) {
      const remaining = 750000 - this.metrics.totalMinted;
      const daysToComplete = remaining / (this.metrics.mintRate * 60 * 24);
      console.log(`Estimated days to complete: ${daysToComplete.toFixed(1)}`);
    }
    
    console.log("=" .repeat(50));
    
    // Send daily report
    await this.sendAlert(
      `Daily Report: ${this.metrics.totalMinted} COAs minted, ${goalProgress}% of goal`,
      "report"
    );
  }

  async sendAlert(message, type = "info") {
    const webhook = process.env.MONITORING_WEBHOOK_URL;
    const email = process.env.ALERT_EMAIL;
    
    console.log(`\n[${type.toUpperCase()}] ${message}`);
    
    if (webhook) {
      try {
        await axios.post(webhook, {
          text: `[Blockticity Monitor] ${type.toUpperCase()}: ${message}`,
          timestamp: new Date().toISOString(),
          contract: this.contractAddress,
          metrics: {
            totalMinted: this.metrics.totalMinted,
            uniqueRecipients: this.metrics.uniqueRecipients.size,
          }
        });
      } catch (error) {
        console.error("Failed to send webhook:", error.message);
      }
    }
  }

  async start() {
    console.log(`${colors.bright}${colors.blue}Blockticity Contract Monitor${colors.reset}`);
    console.log("=" .repeat(50));
    
    await this.initialize();
    
    console.log(`\n${colors.green}Monitoring started${colors.reset}`);
    console.log("Press Ctrl+C to stop\n");
    
    // Initial metrics check
    await this.checkMetrics();
    
    // Set up periodic checks
    const metricsInterval = setInterval(() => this.checkMetrics(), this.checkInterval);
    
    // Daily report at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;
    
    setTimeout(() => {
      this.generateDailyReport();
      // Then repeat every 24 hours
      setInterval(() => this.generateDailyReport(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    
    // Handle shutdown
    process.on("SIGINT", async () => {
      console.log(`\n${colors.yellow}Shutting down monitor...${colors.reset}`);
      clearInterval(metricsInterval);
      await this.sendAlert("Monitor shutting down", "info");
      process.exit(0);
    });
  }
}

async function main() {
  const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("Usage: node monitor-contract.js <contract-address>");
    console.error("Or set CONTRACT_ADDRESS in .env");
    process.exit(1);
  }
  
  const monitor = new ContractMonitor(contractAddress);
  await monitor.start();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});