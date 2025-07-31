const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const axios = require("axios");
const FormData = require("form-data");
const pLimit = require("p-limit");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
  PINATA_API_KEY: process.env.PINATA_API_KEY,
  PINATA_SECRET_KEY: process.env.PINATA_SECRET_API_KEY,
  BATCH_SIZE: 50, // Optimal batch size for gas efficiency
  IPFS_UPLOAD_CONCURRENCY: 5, // Parallel IPFS uploads
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 5000, // 5 seconds
  GAS_BUFFER: 1.2, // 20% gas buffer
};

class BatchMinter {
  constructor(contractAddress) {
    this.contractAddress = contractAddress;
    this.contract = null;
    this.signer = null;
    this.stats = {
      totalToMint: 0,
      minted: 0,
      failed: 0,
      ipfsUploaded: 0,
      startTime: Date.now(),
    };
    this.ipfsLimit = pLimit(CONFIG.IPFS_UPLOAD_CONCURRENCY);
  }

  async initialize() {
    console.log(`${colors.cyan}Initializing batch minter...${colors.reset}`);
    
    // Get signer and contract
    [this.signer] = await ethers.getSigners();
    const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
    this.contract = BlockticityLayerZero.attach(this.contractAddress);
    
    // Verify contract
    const owner = await this.contract.owner();
    if (owner.toLowerCase() !== this.signer.address.toLowerCase()) {
      throw new Error("Signer is not the contract owner");
    }
    
    console.log(`Contract: ${this.contractAddress}`);
    console.log(`Owner: ${this.signer.address}`);
    console.log(`Current Token ID: ${await this.contract.currentTokenId()}`);
  }

  async uploadToIPFS(metadata, retries = CONFIG.RETRY_ATTEMPTS) {
    try {
      const data = new FormData();
      data.append("file", Buffer.from(JSON.stringify(metadata)), {
        filename: `coa_${metadata.attributes.find(a => a.trait_type === "Order ID")?.value}.json`,
      });
      
      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        data,
        {
          headers: {
            ...data.getHeaders(),
            pinata_api_key: CONFIG.PINATA_API_KEY,
            pinata_secret_api_key: CONFIG.PINATA_SECRET_KEY,
          },
          maxBodyLength: Infinity,
        }
      );
      
      this.stats.ipfsUploaded++;
      return `ipfs://${response.data.IpfsHash}`;
    } catch (error) {
      if (retries > 0) {
        console.log(`${colors.yellow}IPFS upload failed, retrying...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        return this.uploadToIPFS(metadata, retries - 1);
      }
      throw error;
    }
  }

  async prepareBatch(records) {
    console.log(`\nPreparing batch of ${records.length} COAs...`);
    
    const uploadPromises = records.map(record => 
      this.ipfsLimit(async () => {
        try {
          // Create metadata from CSV record
          const metadata = {
            name: `Blockticity COA #${record.coa_id}`,
            description: "Certificate of Authenticity - ASTM D8558 Compliant",
            image: record.image_ipfs || "ipfs://QmDefault",
            external_url: `https://blockticity.io/coa/${record.coa_id}`,
            attributes: [
              { trait_type: "Order ID", value: record.order_id },
              { trait_type: "COA ID", value: record.coa_id },
              { trait_type: "Date", value: record.date || new Date().toISOString() },
              { trait_type: "Product", value: record.product },
              { trait_type: "Volume", value: record.volume },
              { trait_type: "Origin", value: record.origin },
              { trait_type: "Standard", value: "ASTM D8558" },
            ],
          };
          
          // Upload to IPFS
          const uri = await this.uploadToIPFS(metadata);
          
          return {
            recipient: record.recipient || this.signer.address,
            uri,
            coaId: record.coa_id,
          };
        } catch (error) {
          console.error(`Failed to prepare COA ${record.coa_id}: ${error.message}`);
          return null;
        }
      })
    );
    
    const results = await Promise.all(uploadPromises);
    return results.filter(r => r !== null);
  }

  async mintBatch(batch, retries = CONFIG.RETRY_ATTEMPTS) {
    const recipients = batch.map(b => b.recipient);
    const uris = batch.map(b => b.uri);
    
    try {
      console.log(`\nMinting batch of ${batch.length} NFTs...`);
      
      // Estimate gas
      const gasEstimate = await this.contract.batchMintURI.estimateGas(recipients, uris);
      const gasLimit = gasEstimate * BigInt(Math.floor(CONFIG.GAS_BUFFER * 100)) / 100n;
      
      // Get gas price
      const feeData = await ethers.provider.getFeeData();
      
      // Execute batch mint
      const tx = await this.contract.batchMintURI(recipients, uris, {
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });
      
      console.log(`Transaction hash: ${tx.hash}`);
      console.log("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      console.log(`${colors.green}Batch minted successfully!${colors.reset}`);
      console.log(`Gas used: ${receipt.gasUsed.toString()}`);
      
      this.stats.minted += batch.length;
      
      // Log minted COAs
      const mintLog = batch.map(b => ({
        coaId: b.coaId,
        recipient: b.recipient,
        uri: b.uri,
        txHash: tx.hash,
        timestamp: new Date().toISOString(),
      }));
      
      this.saveMintLog(mintLog);
      
      return receipt;
    } catch (error) {
      console.error(`${colors.red}Batch mint failed: ${error.message}${colors.reset}`);
      
      if (retries > 0 && error.message.includes("replacement fee too low")) {
        console.log("Retrying with higher gas...");
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        return this.mintBatch(batch, retries - 1);
      }
      
      this.stats.failed += batch.length;
      throw error;
    }
  }

  saveMintLog(mintLog) {
    const logDir = path.join(__dirname, "..", "mint-logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    
    const logFile = path.join(logDir, `mint-log-${Date.now()}.json`);
    fs.writeFileSync(logFile, JSON.stringify(mintLog, null, 2));
  }

  async processCSV(csvPath) {
    return new Promise((resolve, reject) => {
      const records = [];
      
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on("data", (data) => records.push(data))
        .on("end", () => {
          console.log(`Loaded ${records.length} records from CSV`);
          this.stats.totalToMint = records.length;
          resolve(records);
        })
        .on("error", reject);
    });
  }

  printProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.minted / elapsed;
    const remaining = this.stats.totalToMint - this.stats.minted - this.stats.failed;
    const eta = remaining / rate;
    
    console.log(`\n${colors.cyan}Progress Update:${colors.reset}`);
    console.log(`Total: ${this.stats.totalToMint} | Minted: ${this.stats.minted} | Failed: ${this.stats.failed}`);
    console.log(`Rate: ${rate.toFixed(2)} COAs/second`);
    console.log(`ETA: ${(eta / 60).toFixed(1)} minutes`);
    console.log(`IPFS Uploaded: ${this.stats.ipfsUploaded}`);
  }

  async run(csvPath) {
    console.log(`${colors.bright}${colors.blue}Blockticity Batch Minting System${colors.reset}`);
    console.log("=" .repeat(50));
    
    try {
      // Initialize
      await this.initialize();
      
      // Load CSV data
      const records = await this.processCSV(csvPath);
      
      // Process in batches
      for (let i = 0; i < records.length; i += CONFIG.BATCH_SIZE) {
        const batchRecords = records.slice(i, i + CONFIG.BATCH_SIZE);
        
        console.log(`\n${colors.yellow}Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(records.length / CONFIG.BATCH_SIZE)}${colors.reset}`);
        
        // Prepare batch (upload to IPFS)
        const batch = await this.prepareBatch(batchRecords);
        
        if (batch.length > 0) {
          // Mint batch
          await this.mintBatch(batch);
        }
        
        // Print progress
        this.printProgress();
        
        // Rate limiting pause
        if (i + CONFIG.BATCH_SIZE < records.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Final report
      console.log(`\n${colors.bright}${colors.green}Batch Minting Complete!${colors.reset}`);
      console.log("=" .repeat(50));
      console.log(`Total Minted: ${this.stats.minted}`);
      console.log(`Failed: ${this.stats.failed}`);
      console.log(`Success Rate: ${((this.stats.minted / this.stats.totalToMint) * 100).toFixed(2)}%`);
      console.log(`Total Time: ${((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(2)} minutes`);
      
    } catch (error) {
      console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
      process.exitCode = 1;
    }
  }
}

// Production monitoring webhook
async function sendMonitoringAlert(message, type = "info") {
  if (process.env.MONITORING_WEBHOOK_URL) {
    try {
      await axios.post(process.env.MONITORING_WEBHOOK_URL, {
        text: `[Blockticity Minting] ${type.toUpperCase()}: ${message}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to send monitoring alert:", error.message);
    }
  }
}

async function main() {
  const csvPath = process.argv[2];
  const contractAddress = process.argv[3] || CONFIG.CONTRACT_ADDRESS;
  
  if (!csvPath) {
    console.error("Usage: node batch-mint-production.js <csv-file> [contract-address]");
    process.exit(1);
  }
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  if (!contractAddress) {
    console.error("Contract address not provided");
    process.exit(1);
  }
  
  // Send start notification
  await sendMonitoringAlert(`Starting batch mint from ${path.basename(csvPath)}`, "info");
  
  const minter = new BatchMinter(contractAddress);
  await minter.run(csvPath);
  
  // Send completion notification
  await sendMonitoringAlert(
    `Batch mint complete: ${minter.stats.minted} minted, ${minter.stats.failed} failed`,
    minter.stats.failed > 0 ? "warning" : "success"
  );
}

// Handle process termination
process.on("SIGINT", async () => {
  console.log(`\n${colors.yellow}Process interrupted. Shutting down gracefully...${colors.reset}`);
  await sendMonitoringAlert("Batch minting interrupted", "warning");
  process.exit(0);
});

main().catch(async (error) => {
  console.error(error);
  await sendMonitoringAlert(`Fatal error: ${error.message}`, "error");
  process.exitCode = 1;
});