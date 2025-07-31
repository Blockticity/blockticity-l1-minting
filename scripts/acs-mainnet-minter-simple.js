const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const crypto = require("crypto");

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

class ACSMainnetMinter {
  constructor() {
    this.config = {
      contractAddress: process.env.CONTRACT_ADDRESS,
      batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    };
    
    this.stats = {
      totalCertificates: 0,
      minted: 0,
      failed: 0,
      startTime: Date.now(),
      gasUsed: 0n,
      transactionHashes: [],
    };
    
    this.privateFields = ["client_name", "lab_results", "gps_coordinates"];
    this.publicFields = ["order_id", "date", "volume", "product_type", "certification_status"];
  }

  async initialize() {
    console.log(`${colors.bright}${colors.blue}🚀 ACS MAINNET BATCH MINTER 🚀${colors.reset}`);
    console.log("=" .repeat(60));
    console.log("Production deployment on Blockticity L1 Mainnet");
    console.log("Target: ACS Lab certificates with privacy masking");
    console.log("Network: Blockticity L1 (Chain ID: 28530)\n");
    
    const [signer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(signer.address);
    
    console.log(`${colors.cyan}Environment:${colors.reset}`);
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`Contract: ${this.config.contractAddress}`);
    console.log(`Minting Wallet: ${signer.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} BTIC`);
    
    if (network.chainId !== 28530n) {
      throw new Error(`Wrong network! Expected 28530, got ${network.chainId}`);
    }
    
    // Initialize contract
    const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
    this.contract = BlockticityLayerZero.attach(this.config.contractAddress);
    
    console.log(`${colors.green}✅ Environment initialized${colors.reset}\n`);
  }

  async loadCertificates(csvPath) {
    console.log(`${colors.cyan}Loading ACS certificates from: ${path.basename(csvPath)}${colors.reset}`);
    
    const certificates = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on("data", (data) => certificates.push(data))
        .on("end", () => {
          console.log(`Loaded ${certificates.length} certificates`);
          resolve(certificates);
        })
        .on("error", reject);
    });
  }

  separateMetadata(certificate) {
    const publicMetadata = {};
    const privateMetadata = {};
    
    Object.keys(certificate).forEach(key => {
      if (this.privateFields.includes(key)) {
        privateMetadata[key] = "[MASKED]"; // Mask for public view
      } else {
        publicMetadata[key] = certificate[key];
      }
    });
    
    return { publicMetadata, privateMetadata };
  }

  createCertificateMetadata(certificate, index) {
    const { publicMetadata } = this.separateMetadata(certificate);
    
    // Create public metadata with embedded design
    const metadata = {
      name: `ACS Lab Certificate #${String(index + 1).padStart(4, "0")}`,
      description: "ACS Laboratory Certificate of Analysis - ASTM D8558 Compliant. This certificate contains masked sensitive data for privacy protection. Authorized users can access full details through the Blockticity COA viewer.",
      image: "data:image/svg+xml;base64," + Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background: #f8f9fa;">
          <defs>
            <style>
              .header { font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; text-anchor: middle; }
              .title { font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; text-anchor: middle; }
              .field { font-family: Arial, sans-serif; font-size: 12px; }
              .value { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; }
              .watermark { font-family: Arial, sans-serif; font-size: 10px; fill: #666; }
            </style>
          </defs>
          
          <!-- Background -->
          <rect width="800" height="600" fill="white" stroke="#000" stroke-width="2"/>
          
          <!-- Header -->
          <text x="400" y="40" class="header" fill="#000">ACS LABORATORY</text>
          <text x="400" y="65" class="title" fill="#000">CERTIFICATE OF ANALYSIS</text>
          
          <!-- Certificate Info -->
          <rect x="50" y="100" width="700" height="300" fill="none" stroke="#ccc" stroke-width="1"/>
          
          <!-- Public Fields -->
          <text x="70" y="130" class="field" fill="#000">Order ID:</text>
          <text x="200" y="130" class="value" fill="#000">${publicMetadata.order_id || "ACS-" + (index + 1)}</text>
          
          <text x="70" y="150" class="field" fill="#000">Date:</text>
          <text x="200" y="150" class="value" fill="#000">${publicMetadata.date || "2025-06-07"}</text>
          
          <text x="70" y="170" class="field" fill="#000">Volume:</text>
          <text x="200" y="170" class="value" fill="#000">${publicMetadata.volume || "N/A"}</text>
          
          <text x="70" y="190" class="field" fill="#000">Product Type:</text>
          <text x="200" y="190" class="value" fill="#000">${publicMetadata.product_type || "Lab Sample"}</text>
          
          <text x="70" y="210" class="field" fill="#000">Status:</text>
          <text x="200" y="210" class="value" fill="#000">${publicMetadata.certification_status || "Verified"}</text>
          
          <!-- Privacy Notice -->
          <rect x="70" y="240" width="660" height="60" fill="#f0f0f0" stroke="#ccc"/>
          <text x="400" y="260" class="field" text-anchor="middle" fill="#666">PRIVACY PROTECTED</text>
          <text x="400" y="275" class="field" text-anchor="middle" fill="#666">Sensitive data masked for public view</text>
          <text x="400" y="290" class="field" text-anchor="middle" fill="#666">Authorized access via app.blockticity.io</text>
          
          <!-- Verification -->
          <rect x="50" y="430" width="700" height="120" fill="#e8f4fd" stroke="#000"/>
          <text x="400" y="460" class="title" text-anchor="middle" fill="#000">BLOCKCHAIN VERIFIED</text>
          <text x="400" y="480" class="field" text-anchor="middle" fill="#000">ASTM D8558 Compliant</text>
          <text x="400" y="500" class="field" text-anchor="middle" fill="#000">Blockticity L1 Mainnet</text>
          <text x="400" y="520" class="field" text-anchor="middle" fill="#000">Certificate #${index + 1}</text>
          
          <!-- Watermarks -->
          <text x="50" y="580" class="watermark">Minted: ${new Date().toISOString()}</text>
          <text x="750" y="580" class="watermark" text-anchor="end">Chain ID: 28530</text>
        </svg>
      `).toString('base64'),
      external_url: `https://app.blockticity.io/coa/viewer.html?id=${publicMetadata.order_id || index}`,
      attributes: [
        { trait_type: "Certificate Type", value: "ACS Lab COA" },
        { trait_type: "Order ID", value: publicMetadata.order_id || `ACS-${index + 1}` },
        { trait_type: "Date", value: publicMetadata.date || new Date().toISOString().split('T')[0] },
        { trait_type: "Volume", value: publicMetadata.volume || "N/A" },
        { trait_type: "Product Type", value: publicMetadata.product_type || "Lab Sample" },
        { trait_type: "Certification Status", value: publicMetadata.certification_status || "Verified" },
        { trait_type: "Network", value: "Blockticity L1" },
        { trait_type: "Chain ID", value: "28530" },
        { trait_type: "Standard", value: "ASTM D8558" },
        { trait_type: "Privacy Level", value: "Masked" },
        { trait_type: "Batch", value: "ACS Production" },
        { trait_type: "Minted", value: new Date().toISOString() },
        { trait_type: "Certificate Number", value: String(index + 1) }
      ],
      properties: {
        category: "Certificate of Analysis",
        creator: "ACS Laboratory",
        blockchain: "Blockticity L1",
        privacy_enabled: true,
        viewer_url: "https://app.blockticity.io/coa/viewer.html",
        production_batch: true
      }
    };
    
    return metadata;
  }

  async mintCertificate(certificate, index) {
    try {
      const metadata = this.createCertificateMetadata(certificate, index);
      const metadataURI = "data:application/json;base64," + Buffer.from(JSON.stringify(metadata)).toString('base64');
      
      console.log(`Minting Certificate #${index + 1}: ${certificate.order_id || `ACS-${index + 1}`}`);
      
      // Estimate gas
      const gasEstimate = await this.contract.mintURI.estimateGas(
        process.env.MINTING_WALLET || process.env.MAINNET_OWNER_ADDRESS,
        metadataURI
      );
      
      // Execute mint
      const tx = await this.contract.mintURI(
        process.env.MINTING_WALLET || process.env.MAINNET_OWNER_ADDRESS,
        metadataURI,
        {
          gasLimit: gasEstimate * 120n / 100n, // 20% buffer
        }
      );
      
      console.log(`✅ Transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      this.stats.gasUsed += receipt.gasUsed;
      this.stats.transactionHashes.push(tx.hash);
      this.stats.minted++;
      
      console.log(`✅ Minted in block: ${receipt.blockNumber}`);
      
      return { success: true, tx: tx.hash, block: receipt.blockNumber };
      
    } catch (error) {
      console.error(`❌ Failed to mint certificate ${index + 1}: ${error.message}`);
      this.stats.failed++;
      return { success: false, error: error.message };
    }
  }

  async processBatch(certificates) {
    console.log(`\n${colors.cyan}Processing ${certificates.length} ACS certificates...${colors.reset}`);
    
    const results = [];
    
    for (let i = 0; i < certificates.length; i++) {
      const certificate = certificates[i];
      
      console.log(`\n${colors.yellow}[${i + 1}/${certificates.length}] Processing: ${certificate.order_id || `ACS-${i + 1}`}${colors.reset}`);
      
      const result = await this.mintCertificate(certificate, i);
      results.push(result);
      
      // Progress update
      this.printProgress();
      
      // Add delay between mints for stability
      if (i < certificates.length - 1) {
        console.log("Waiting 3 seconds before next mint...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    return results;
  }

  printProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.minted / elapsed;
    
    console.log(`\n${colors.cyan}📊 Progress:${colors.reset}`);
    console.log(`Minted: ${this.stats.minted} | Failed: ${this.stats.failed}`);
    console.log(`Rate: ${rate.toFixed(2)} COAs/second`);
    console.log(`Gas Used: ${ethers.formatEther(this.stats.gasUsed)} BTIC`);
  }

  async generateFinalReport() {
    const report = {
      timestamp: new Date().toISOString(),
      batch: "ACS Lab Production",
      network: "Blockticity L1 Mainnet",
      contract: this.config.contractAddress,
      stats: {
        totalCertificates: this.stats.totalCertificates,
        minted: this.stats.minted,
        failed: this.stats.failed,
        successRate: (this.stats.minted / this.stats.totalCertificates * 100).toFixed(2) + "%",
        totalGasUsed: ethers.formatEther(this.stats.gasUsed) + " BTIC",
        totalTime: ((Date.now() - this.stats.startTime) / 1000 / 60).toFixed(2) + " minutes"
      },
      transactionHashes: this.stats.transactionHashes,
      explorer: {
        contract: `https://subnets.avax.network/btic/address/${this.config.contractAddress}`,
        transactions: this.stats.transactionHashes.map(hash => 
          `https://subnets.avax.network/btic/tx/${hash}`
        )
      }
    };
    
    const reportPath = path.join(__dirname, "..", `acs-production-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n${colors.bright}${colors.green}🎉 ACS PRODUCTION BATCH COMPLETE! 🎉${colors.reset}`);
    console.log("=" .repeat(60));
    console.log(`Total Certificates: ${this.stats.totalCertificates}`);
    console.log(`Successfully Minted: ${this.stats.minted}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Success Rate: ${report.stats.successRate}`);
    console.log(`Total Gas Used: ${report.stats.totalGasUsed}`);
    console.log(`Total Time: ${report.stats.totalTime}`);
    console.log(`\nContract: ${this.config.contractAddress}`);
    console.log(`Explorer: https://subnets.avax.network/btic/address/${this.config.contractAddress}`);
    console.log(`\nReport saved: ${path.basename(reportPath)}`);
    
    return report;
  }

  async run(csvPath) {
    try {
      await this.initialize();
      
      const certificates = await this.loadCertificates(csvPath);
      this.stats.totalCertificates = certificates.length;
      
      console.log(`\n${colors.bright}Starting production minting of ${certificates.length} ACS certificates${colors.reset}`);
      
      const results = await this.processBatch(certificates);
      
      const report = await this.generateFinalReport();
      
      return report;
      
    } catch (error) {
      console.error(`\n${colors.red}Production minting failed:${colors.reset}`, error);
      process.exitCode = 1;
    }
  }
}

async function main() {
  const csvPath = process.argv[2] || path.join(__dirname, "..", "acs-certificates-sample.csv");
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    console.error("Usage: npx hardhat run scripts/acs-mainnet-minter-simple.js --network blockticityMainnet [csv-file]");
    process.exit(1);
  }
  
  const minter = new ACSMainnetMinter();
  await minter.run(csvPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});