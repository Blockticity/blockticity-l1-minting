const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const axios = require("axios");
const FormData = require("form-data");
const crypto = require("crypto");
const pLimit = require("p-limit");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

class ACSProductionMinter {
  constructor() {
    this.config = {
      contractAddress: process.env.CONTRACT_ADDRESS,
      batchSize: parseInt(process.env.BATCH_SIZE) || 25,
      maxConcurrent: parseInt(process.env.MAX_CONCURRENT_UPLOADS) || 5,
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.RETRY_DELAY) || 5000,
      gasBuffer: parseInt(process.env.GAS_BUFFER_PERCENT) || 25,
    };
    
    this.stats = {
      totalCertificates: 0,
      processed: 0,
      minted: 0,
      failed: 0,
      ipfsUploaded: 0,
      startTime: Date.now(),
      gasUsed: 0n,
      transactionHashes: [],
      failedCertificates: [],
    };
    
    this.ipfsLimit = pLimit(this.config.maxConcurrent);
    this.s3 = null;
    this.contract = null;
    this.signer = null;
    
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
    this.privateFields = (process.env.PRIVATE_FIELDS || "").split(",");
    this.publicFields = (process.env.PUBLIC_FIELDS || "").split(",");
  }

  async initialize() {
    console.log(`${colors.bright}${colors.blue}🚀 ACS PRODUCTION BATCH MINTER 🚀${colors.reset}`);
    console.log("=" .repeat(60));
    console.log("Large-scale production deployment on Blockticity L1 Mainnet");
    console.log("Target: Several thousand ACS Lab certificates");
    console.log("Privacy: Masked public + encrypted private metadata");
    console.log("Integration: app.blockticity.io production frontend\n");
    
    // Verify environment
    this.verifyEnvironment();
    
    // Initialize AWS S3
    await this.initializeS3();
    
    // Initialize blockchain
    await this.initializeBlockchain();
    
    // Verify production infrastructure
    await this.verifyProductionInfrastructure();
    
    console.log(`${colors.green}✅ Production environment initialized${colors.reset}\n`);
  }

  verifyEnvironment() {
    const required = [
      "CONTRACT_ADDRESS",
      "MAINNET_PRIVATE_KEY",
      "PINATA_API_KEY",
      "PINATA_SECRET_API_KEY"
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    
    console.log(`${colors.cyan}Environment Configuration:${colors.reset}`);
    console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
    console.log(`Chain ID: ${process.env.MAINNET_CHAIN_ID || 28530}`);
    console.log(`Batch Size: ${this.config.batchSize}`);
    console.log(`Concurrent Uploads: ${this.config.maxConcurrent}`);
  }

  async initializeS3() {
    if (!process.env.S3_BUCKET_NAME) {
      console.log(`${colors.yellow}⚠️  S3 not configured - will look for local data${colors.reset}`);
      return;
    }
    
    this.s3 = new AWS.S3({
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      region: process.env.S3_REGION || "us-east-1"
    });
    
    console.log(`${colors.cyan}S3 Configuration:${colors.reset}`);
    console.log(`Bucket: ${process.env.S3_BUCKET_NAME}`);
    console.log(`Prefix: ${process.env.ACS_DATA_PREFIX || "acs-lab-certificates/"}`);
  }

  async initializeBlockchain() {
    [this.signer] = await ethers.getSigners();
    
    const network = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(this.signer.address);
    
    console.log(`${colors.cyan}Blockchain Configuration:${colors.reset}`);
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Minting Wallet: ${this.signer.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} BTIC`);
    
    // Verify we're on mainnet
    if (network.chainId !== 28530n) {
      throw new Error(`Wrong network! Expected Chain ID 28530, got ${network.chainId}`);
    }
    
    // Initialize contract
    const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
    this.contract = BlockticityLayerZero.attach(this.config.contractAddress);
    
    // Verify contract ownership
    try {
      const owner = await this.contract.owner();
      console.log(`Contract Owner: ${owner}`);
      
      if (owner.toLowerCase() !== this.signer.address.toLowerCase()) {
        console.log(`${colors.yellow}⚠️  Warning: Signer is not contract owner${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.yellow}⚠️  Could not verify contract ownership${colors.reset}`);
    }
  }

  async verifyProductionInfrastructure() {
    console.log(`${colors.cyan}Verifying Production Infrastructure:${colors.reset}`);
    
    const endpoints = [
      { name: "Main Portal", url: process.env.PRODUCTION_BASE_URL },
      { name: "Auth Gateway", url: process.env.AUTH_GATEWAY_URL },
      { name: "COA Viewer", url: process.env.COA_VIEWER_URL },
      { name: "CoAi Dashboard", url: process.env.COAI_DASHBOARD_URL },
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.head(endpoint.url, { timeout: 10000 });
        console.log(`✅ ${endpoint.name}: ${response.status}`);
      } catch (error) {
        console.log(`⚠️  ${endpoint.name}: ${error.code || "Error"}`);
      }
    }
  }

  async loadACSCertificates() {
    console.log(`${colors.cyan}Loading ACS Lab certificates...${colors.reset}`);
    
    // First, check for local CSV files
    const localFiles = [
      "acs-certificates.csv",
      "acs-lab-data.csv",
      "production-certificates.csv"
    ].map(file => path.join(__dirname, "..", file));
    
    for (const filePath of localFiles) {
      if (fs.existsSync(filePath)) {
        console.log(`Found local data file: ${path.basename(filePath)}`);
        return this.parseCSVFile(filePath);
      }
    }
    
    // If no local files, try S3
    if (this.s3) {
      return this.loadFromS3();
    }
    
    throw new Error("No ACS certificate data found. Please provide CSV file or configure S3.");
  }

  async parseCSVFile(filePath) {
    const csv = require("csv-parser");
    const certificates = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => certificates.push(data))
        .on("end", () => {
          console.log(`Loaded ${certificates.length} certificates from ${path.basename(filePath)}`);
          resolve(certificates);
        })
        .on("error", reject);
    });
  }

  async loadFromS3() {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Prefix: process.env.ACS_DATA_PREFIX || "acs-lab-certificates/"
    };
    
    const objects = await this.s3.listObjectsV2(params).promise();
    console.log(`Found ${objects.Contents.length} files in S3`);
    
    // Implementation for S3 data loading would go here
    // For now, return empty array and prompt for local files
    return [];
  }

  separateMetadata(certificate) {
    const publicMetadata = {};
    const privateMetadata = {};
    
    // Separate fields based on configuration
    Object.keys(certificate).forEach(key => {
      if (this.privateFields.includes(key)) {
        privateMetadata[key] = certificate[key];
      } else {
        publicMetadata[key] = certificate[key];
      }
    });
    
    return { publicMetadata, privateMetadata };
  }

  encryptPrivateData(data) {
    const cipher = crypto.createCipher("aes-256-cbc", this.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  async createCertificateMetadata(certificate, index) {
    const { publicMetadata, privateMetadata } = this.separateMetadata(certificate);
    
    // Create public metadata for IPFS
    const metadata = {
      name: `ACS Lab Certificate #${String(index + 1).padStart(4, "0")}`,
      description: "ACS Laboratory Certificate of Analysis - ASTM D8558 Compliant",
      image: "ipfs://QmACSLabCertificateImage", // Placeholder
      external_url: `${process.env.COA_VIEWER_URL}?id=${certificate.order_id || index}`,
      attributes: [
        { trait_type: "Certificate Type", value: "ACS Lab COA" },
        { trait_type: "Order ID", value: publicMetadata.order_id || `ACS-${index + 1}` },
        { trait_type: "Date", value: publicMetadata.date || new Date().toISOString().split('T')[0] },
        { trait_type: "Volume", value: publicMetadata.volume || "N/A" },
        { trait_type: "Product Type", value: publicMetadata.product_type || "Lab Sample" },
        { trait_type: "Certification Status", value: publicMetadata.certification_status || "Verified" },
        { trait_type: "Network", value: "Blockticity L1" },
        { trait_type: "Standard", value: "ASTM D8558" },
        { trait_type: "Privacy Level", value: "Masked" },
        { trait_type: "Batch", value: "ACS Production" },
        { trait_type: "Minted", value: new Date().toISOString() }
      ],
      properties: {
        category: "Certificate of Analysis",
        creator: "ACS Laboratory",
        blockchain: "Blockticity L1",
        privacy_enabled: true,
        encrypted_fields: Object.keys(privateMetadata),
        viewer_url: process.env.COA_VIEWER_URL
      }
    };
    
    // Add encrypted private data reference if exists
    if (Object.keys(privateMetadata).length > 0) {
      const encryptedData = this.encryptPrivateData(privateMetadata);
      metadata.properties.encrypted_data_hash = crypto
        .createHash("sha256")
        .update(encryptedData)
        .digest("hex");
    }
    
    return metadata;
  }

  async uploadToIPFS(data, filename) {
    try {
      const formData = new FormData();
      formData.append("file", Buffer.from(JSON.stringify(data)), { filename });
      formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
      formData.append("pinataMetadata", JSON.stringify({
        name: filename,
        keyvalues: {
          project: "Blockticity",
          type: "ACS Lab COA",
          batch: "Production",
          privacy: "Masked"
        }
      }));

      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            pinata_api_key: process.env.PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
          },
          maxBodyLength: Infinity,
        }
      );

      this.stats.ipfsUploaded++;
      return response.data.IpfsHash;
    } catch (error) {
      console.error(`IPFS upload failed for ${filename}:`, error.message);
      throw error;
    }
  }

  async processBatch(certificates) {
    console.log(`\n${colors.cyan}Processing batch of ${certificates.length} certificates...${colors.reset}`);
    
    const uploadPromises = certificates.map((cert, index) => 
      this.ipfsLimit(async () => {
        try {
          const metadata = await this.createCertificateMetadata(cert, this.stats.processed + index);
          const filename = `acs_coa_${String(this.stats.processed + index + 1).padStart(4, "0")}.json`;
          const ipfsHash = await this.uploadToIPFS(metadata, filename);
          
          return {
            certificate: cert,
            metadata,
            ipfsHash,
            uri: `ipfs://${ipfsHash}`,
            recipient: this.signer.address
          };
        } catch (error) {
          console.error(`Failed to process certificate ${index}:`, error.message);
          this.stats.failed++;
          return null;
        }
      })
    );
    
    const results = await Promise.all(uploadPromises);
    return results.filter(r => r !== null);
  }

  async mintBatch(batch) {
    const recipients = batch.map(b => b.recipient);
    const uris = batch.map(b => b.uri);
    
    try {
      console.log(`\n${colors.cyan}Minting batch of ${batch.length} NFTs...${colors.reset}`);
      
      // For production, mint one at a time to ensure reliability
      const mintPromises = [];
      
      for (let i = 0; i < batch.length; i++) {
        const recipient = recipients[i];
        const uri = uris[i];
        
        try {
          // Estimate gas
          const gasEstimate = await this.contract.mintURI.estimateGas(recipient, uri);
          const gasLimit = gasEstimate * BigInt(100 + this.config.gasBuffer) / 100n;
          
          // Execute mint
          const tx = await this.contract.mintURI(recipient, uri, {
            gasLimit
          });
          
          console.log(`Minted #${this.stats.minted + 1}: ${tx.hash}`);
          
          const receipt = await tx.wait();
          this.stats.gasUsed += receipt.gasUsed;
          this.stats.transactionHashes.push(tx.hash);
          this.stats.minted++;
          
          // Add delay between mints for stability
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`Mint failed for certificate ${i + 1}:`, error.message);
          this.stats.failed++;
          this.stats.failedCertificates.push(batch[i]);
        }
      }
      
    } catch (error) {
      console.error(`Batch mint failed:`, error.message);
      this.stats.failed += batch.length;
      throw error;
    }
  }

  async saveBatchProgress() {
    const progressLog = {
      timestamp: new Date().toISOString(),
      batch: "ACS Lab Production",
      network: "Blockticity L1 Mainnet",
      contract: this.config.contractAddress,
      stats: {
        ...this.stats,
        gasUsed: this.stats.gasUsed.toString(),
        successRate: (this.stats.minted / this.stats.totalCertificates * 100).toFixed(2) + "%",
        avgGasPerMint: this.stats.minted > 0 ? (this.stats.gasUsed / BigInt(this.stats.minted)).toString() : "0"
      },
      transactionHashes: this.stats.transactionHashes,
      failedCertificates: this.stats.failedCertificates.map(c => c.certificate?.order_id || "Unknown")
    };
    
    const logPath = path.join(__dirname, "..", `acs-production-progress-${Date.now()}.json`);
    fs.writeFileSync(logPath, JSON.stringify(progressLog, null, 2));
    
    console.log(`Progress saved to: ${path.basename(logPath)}`);
    return progressLog;
  }

  printProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.minted / elapsed;
    const remaining = this.stats.totalCertificates - this.stats.minted - this.stats.failed;
    const eta = remaining / rate;
    
    console.log(`\n${colors.cyan}🔄 Production Progress Update:${colors.reset}`);
    console.log(`Total: ${this.stats.totalCertificates} | Minted: ${this.stats.minted} | Failed: ${this.stats.failed}`);
    console.log(`Success Rate: ${(this.stats.minted / this.stats.totalCertificates * 100).toFixed(2)}%`);
    console.log(`Minting Rate: ${rate.toFixed(2)} COAs/second`);
    console.log(`ETA: ${(eta / 60).toFixed(1)} minutes`);
    console.log(`IPFS Uploaded: ${this.stats.ipfsUploaded}`);
    console.log(`Gas Used: ${ethers.formatEther(this.stats.gasUsed)} BTIC`);
  }

  async run(csvFilePath) {
    try {
      await this.initialize();
      
      // Load certificates
      const certificates = csvFilePath ? 
        await this.parseCSVFile(csvFilePath) : 
        await this.loadACSCertificates();
      
      this.stats.totalCertificates = certificates.length;
      
      console.log(`\n${colors.bright}Starting production batch minting of ${certificates.length} ACS Lab certificates${colors.reset}`);
      console.log("This will take several hours for large batches...\n");
      
      // Process in batches
      for (let i = 0; i < certificates.length; i += this.config.batchSize) {
        const batchCerts = certificates.slice(i, i + this.config.batchSize);
        const batchNumber = Math.floor(i / this.config.batchSize) + 1;
        const totalBatches = Math.ceil(certificates.length / this.config.batchSize);
        
        console.log(`\n${colors.yellow}Processing Batch ${batchNumber}/${totalBatches}${colors.reset}`);
        
        // Process batch (upload to IPFS)
        const batch = await this.processBatch(batchCerts);
        
        if (batch.length > 0) {
          // Mint batch
          await this.mintBatch(batch);
        }
        
        this.stats.processed += batchCerts.length;
        
        // Progress update
        if (this.stats.minted % 100 === 0 || batchNumber % 10 === 0) {
          this.printProgress();
          await this.saveBatchProgress();
        }
        
        // Rate limiting pause
        if (i + this.config.batchSize < certificates.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // Final report
      const finalLog = await this.saveBatchProgress();
      
      console.log(`\n${colors.bright}${colors.green}🎉 ACS PRODUCTION BATCH COMPLETE! 🎉${colors.reset}`);
      console.log("=" .repeat(60));
      console.log(`Total Certificates: ${this.stats.totalCertificates}`);
      console.log(`Successfully Minted: ${this.stats.minted}`);
      console.log(`Failed: ${this.stats.failed}`);
      console.log(`Success Rate: ${(this.stats.minted / this.stats.totalCertificates * 100).toFixed(2)}%`);
      console.log(`Total Gas Used: ${ethers.formatEther(this.stats.gasUsed)} BTIC`);
      console.log(`Total Time: ${((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(2)} minutes`);
      console.log(`\n${colors.cyan}Production Integration:${colors.reset}`);
      console.log(`Frontend: ${process.env.PRODUCTION_BASE_URL}`);
      console.log(`COA Viewer: ${process.env.COA_VIEWER_URL}`);
      console.log(`Explorer: ${process.env.EXPLORER_URL}`);
      
      return finalLog;
      
    } catch (error) {
      console.error(`\n${colors.red}Production batch minting failed:${colors.reset}`, error);
      await this.saveBatchProgress();
      process.exitCode = 1;
    }
  }
}

async function main() {
  const csvFilePath = process.argv[2];
  
  if (!csvFilePath) {
    console.log("Usage: node acs-production-minter.js <csv-file>");
    console.log("Or ensure S3 configuration is set up");
    process.exit(1);
  }

  const minter = new ACSProductionMinter();
  await minter.run(csvFilePath);
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log(`\n${colors.yellow}Graceful shutdown initiated...${colors.reset}`);
  process.exit(0);
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});