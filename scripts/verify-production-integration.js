const { ethers } = require("hardhat");
const axios = require("axios");
const fs = require("fs");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

class ProductionVerifier {
  constructor() {
    this.config = {
      contractAddress: process.env.CONTRACT_ADDRESS,
      productionBaseUrl: process.env.PRODUCTION_BASE_URL,
      authGatewayUrl: process.env.AUTH_GATEWAY_URL,
      coaViewerUrl: process.env.COA_VIEWER_URL,
      coaiDashboardUrl: process.env.COAI_DASHBOARD_URL,
      explorerUrl: process.env.EXPLORER_URL,
    };
    
    this.results = [];
  }

  async verifyContract() {
    console.log(`${colors.cyan}🔍 Verifying Smart Contract...${colors.reset}`);
    
    try {
      const [signer] = await ethers.getSigners();
      const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
      const contract = BlockticityLayerZero.attach(this.config.contractAddress);
      
      // Basic contract checks
      const name = await contract.name();
      const symbol = await contract.symbol();
      const owner = await contract.owner();
      
      console.log(`✅ Contract Name: ${name}`);
      console.log(`✅ Contract Symbol: ${symbol}`);
      console.log(`✅ Contract Owner: ${owner}`);
      
      // Try to get token count if function exists
      try {
        const currentTokenId = await contract.currentTokenId();
        console.log(`✅ Current Token ID: ${currentTokenId}`);
      } catch (error) {
        console.log(`ℹ️  currentTokenId() not available`);
      }
      
      this.results.push({
        test: "Smart Contract Verification",
        status: "PASS",
        details: { name, symbol, owner }
      });
      
    } catch (error) {
      console.log(`❌ Contract verification failed: ${error.message}`);
      this.results.push({
        test: "Smart Contract Verification",
        status: "FAIL",
        error: error.message
      });
    }
  }

  async verifyProductionEndpoints() {
    console.log(`\n${colors.cyan}🌐 Verifying Production Endpoints...${colors.reset}`);
    
    const endpoints = [
      { name: "Main Portal", url: this.config.productionBaseUrl },
      { name: "Auth Gateway", url: this.config.authGatewayUrl },
      { name: "COA Viewer", url: this.config.coaViewerUrl },
      { name: "CoAi Dashboard", url: this.config.coaiDashboardUrl },
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.head(endpoint.url, { 
          timeout: 10000,
          validateStatus: status => status < 500 // Accept 4xx as valid
        });
        
        console.log(`✅ ${endpoint.name}: ${response.status} ${response.statusText}`);
        
        // Check SSL certificate if HTTPS
        if (endpoint.url.startsWith('https://')) {
          console.log(`🔒 SSL Certificate: Valid`);
        }
        
        this.results.push({
          test: `${endpoint.name} Endpoint`,
          status: "PASS",
          details: { status: response.status, url: endpoint.url }
        });
        
      } catch (error) {
        console.log(`❌ ${endpoint.name}: ${error.code || error.message}`);
        this.results.push({
          test: `${endpoint.name} Endpoint`,
          status: "FAIL",
          error: error.code || error.message
        });
      }
    }
  }

  async verifyBlockchainNetwork() {
    console.log(`\n${colors.cyan}⛓️  Verifying Blockchain Network...${colors.reset}`);
    
    try {
      const network = await ethers.provider.getNetwork();
      const [signer] = await ethers.getSigners();
      const balance = await ethers.provider.getBalance(signer.address);
      const feeData = await ethers.provider.getFeeData();
      
      console.log(`✅ Network: ${network.name} (Chain ID: ${network.chainId})`);
      console.log(`✅ Wallet: ${signer.address}`);
      console.log(`✅ Balance: ${ethers.formatEther(balance)} BTIC`);
      console.log(`✅ Gas Price: ${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`);
      
      // Verify we're on the correct mainnet
      if (network.chainId === 28530n) {
        console.log(`✅ Correct Mainnet: Blockticity L1`);
      } else {
        throw new Error(`Wrong network! Expected Chain ID 28530, got ${network.chainId}`);
      }
      
      this.results.push({
        test: "Blockchain Network",
        status: "PASS",
        details: {
          chainId: network.chainId.toString(),
          balance: ethers.formatEther(balance),
          gasPrice: ethers.formatUnits(feeData.gasPrice, "gwei")
        }
      });
      
    } catch (error) {
      console.log(`❌ Network verification failed: ${error.message}`);
      this.results.push({
        test: "Blockchain Network",
        status: "FAIL",
        error: error.message
      });
    }
  }

  async verifyIPFSConnectivity() {
    console.log(`\n${colors.cyan}📦 Verifying IPFS Connectivity...${colors.reset}`);
    
    const testCID = "QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4";
    const gateways = [
      "https://gateway.pinata.cloud/ipfs/",
      "https://ipfs.io/ipfs/",
      "https://cloudflare-ipfs.com/ipfs/"
    ];
    
    for (const gateway of gateways) {
      try {
        const response = await axios.get(`${gateway}${testCID}`, { timeout: 10000 });
        console.log(`✅ IPFS Gateway: ${gateway} (${response.status})`);
        
        this.results.push({
          test: `IPFS Gateway - ${gateway}`,
          status: "PASS",
          details: { status: response.status }
        });
        
      } catch (error) {
        console.log(`⚠️  IPFS Gateway failed: ${gateway}`);
        this.results.push({
          test: `IPFS Gateway - ${gateway}`,
          status: "FAIL",
          error: error.code || error.message
        });
      }
    }
  }

  async verifyPinataAPI() {
    console.log(`\n${colors.cyan}📌 Verifying Pinata API...${colors.reset}`);
    
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
      console.log(`❌ Pinata API keys not configured`);
      this.results.push({
        test: "Pinata API Configuration",
        status: "FAIL",
        error: "API keys not configured"
      });
      return;
    }
    
    try {
      const response = await axios.get(
        "https://api.pinata.cloud/data/testAuthentication",
        {
          headers: {
            pinata_api_key: process.env.PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
          },
          timeout: 10000
        }
      );
      
      console.log(`✅ Pinata API: Authenticated`);
      console.log(`✅ Message: ${response.data.message}`);
      
      this.results.push({
        test: "Pinata API",
        status: "PASS",
        details: response.data
      });
      
    } catch (error) {
      console.log(`❌ Pinata API failed: ${error.response?.status || error.message}`);
      this.results.push({
        test: "Pinata API",
        status: "FAIL",
        error: error.response?.data || error.message
      });
    }
  }

  async testMintingCapability() {
    console.log(`\n${colors.cyan}🔨 Testing Minting Capability...${colors.reset}`);
    
    try {
      const [signer] = await ethers.getSigners();
      const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
      const contract = BlockticityLayerZero.attach(this.config.contractAddress);
      
      const testURI = "data:application/json;base64," + Buffer.from(JSON.stringify({
        name: "Production Test Certificate",
        description: "Test certificate for production verification",
        attributes: [
          { trait_type: "Type", value: "Production Test" },
          { trait_type: "Timestamp", value: new Date().toISOString() }
        ]
      })).toString('base64');
      
      // Estimate gas only (don't actually mint)
      const gasEstimate = await contract.mintURI.estimateGas(signer.address, testURI);
      console.log(`✅ Mint Gas Estimate: ${gasEstimate.toString()}`);
      
      const feeData = await ethers.provider.getFeeData();
      const estimatedCost = gasEstimate * feeData.gasPrice;
      console.log(`✅ Estimated Cost: ${ethers.formatEther(estimatedCost)} BTIC`);
      
      this.results.push({
        test: "Minting Capability",
        status: "PASS",
        details: {
          gasEstimate: gasEstimate.toString(),
          estimatedCost: ethers.formatEther(estimatedCost)
        }
      });
      
    } catch (error) {
      console.log(`❌ Minting test failed: ${error.message}`);
      this.results.push({
        test: "Minting Capability",
        status: "FAIL",
        error: error.message
      });
    }
  }

  async verifyExplorerIntegration() {
    console.log(`\n${colors.cyan}🔍 Verifying Explorer Integration...${colors.reset}`);
    
    const explorerUrls = [
      `${this.config.explorerUrl}/address/${this.config.contractAddress}`,
      `${this.config.explorerUrl}`,
    ];
    
    for (const url of explorerUrls) {
      try {
        const response = await axios.head(url, { timeout: 10000 });
        console.log(`✅ Explorer URL: ${response.status}`);
        
        this.results.push({
          test: `Explorer - ${url}`,
          status: "PASS",
          details: { status: response.status }
        });
        
      } catch (error) {
        console.log(`⚠️  Explorer URL failed: ${url}`);
        this.results.push({
          test: `Explorer - ${url}`,
          status: "FAIL",
          error: error.code || error.message
        });
      }
    }
  }

  generateReport() {
    const passed = this.results.filter(r => r.status === "PASS").length;
    const failed = this.results.filter(r => r.status === "FAIL").length;
    const total = this.results.length;
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed,
        failed,
        successRate: `${(passed / total * 100).toFixed(2)}%`
      },
      environment: {
        network: "Blockticity L1 Mainnet",
        chainId: 28530,
        contract: this.config.contractAddress,
        production: true
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };
    
    // Save report
    const reportPath = `production-verification-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n${colors.bright}${colors.blue}📋 PRODUCTION VERIFICATION REPORT${colors.reset}`);
    console.log("=" .repeat(60));
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${colors.green}${passed}${colors.reset}`);
    console.log(`Failed: ${colors.red}${failed}${colors.reset}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    
    console.log(`\n${colors.cyan}Detailed Results:${colors.reset}`);
    this.results.forEach(result => {
      const status = result.status === "PASS" ? 
        `${colors.green}✅ PASS${colors.reset}` : 
        `${colors.red}❌ FAIL${colors.reset}`;
      console.log(`${result.test}: ${status}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    if (failed === 0) {
      console.log(`\n${colors.green}${colors.bright}🎉 ALL SYSTEMS GO! Ready for production batch minting.${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠️  ${failed} issues found. Review before proceeding with production.${colors.reset}`);
    }
    
    console.log(`\nReport saved to: ${reportPath}`);
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    const failedTests = this.results.filter(r => r.status === "FAIL");
    
    if (failedTests.length === 0) {
      recommendations.push("✅ All systems verified. Proceed with production batch minting.");
    } else {
      recommendations.push("⚠️  Address the following issues before production:");
      failedTests.forEach(test => {
        recommendations.push(`- Fix: ${test.test}`);
      });
    }
    
    recommendations.push("📊 Monitor gas prices during batch minting");
    recommendations.push("🔄 Set up real-time monitoring during operation");
    recommendations.push("💾 Ensure regular progress backups during large batches");
    recommendations.push("🔍 Verify random samples in production viewer after minting");
    
    return recommendations;
  }

  async run() {
    console.log(`${colors.bright}${colors.blue}🔍 PRODUCTION VERIFICATION SUITE${colors.reset}`);
    console.log("=" .repeat(60));
    console.log("Verifying production readiness for ACS Lab batch minting");
    console.log("Target: app.blockticity.io integration");
    console.log("Network: Blockticity L1 Mainnet\n");
    
    await this.verifyBlockchainNetwork();
    await this.verifyContract();
    await this.verifyProductionEndpoints();
    await this.verifyIPFSConnectivity();
    await this.verifyPinataAPI();
    await this.testMintingCapability();
    await this.verifyExplorerIntegration();
    
    return this.generateReport();
  }
}

async function main() {
  const verifier = new ProductionVerifier();
  await verifier.run();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});