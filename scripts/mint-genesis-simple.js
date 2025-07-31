const { ethers } = require("hardhat");

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

async function main() {
  try {
    console.log(`${colors.bright}${colors.blue}🚀 BLOCKTICITY GENESIS MINT 🚀${colors.reset}`);
    console.log("=" .repeat(50));
    
    const [signer] = await ethers.getSigners();
    const recipient = process.env.MAINNET_OWNER_ADDRESS || signer.address;
    
    console.log(`Network: Blockticity L1 (Chain ID: 28530)`);
    console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Deployer: ${signer.address}\n`);
    
    // Connect to contract using the original simple version
    const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
    const contract = BlockticityLayerZero.attach(process.env.CONTRACT_ADDRESS);
    
    // Test basic contract functions
    console.log("Testing contract functions...");
    try {
      const name = await contract.name();
      const symbol = await contract.symbol();
      const owner = await contract.owner();
      console.log(`Name: ${name}`);
      console.log(`Symbol: ${symbol}`);
      console.log(`Owner: ${owner}`);
      
      // Try to get current token ID
      try {
        const currentTokenId = await contract.currentTokenId();
        console.log(`Current Token ID: ${currentTokenId}\n`);
      } catch (error) {
        console.log("currentTokenId() not available - using simple version\n");
      }
    } catch (error) {
      console.error("Contract function test failed:", error.message);
      return;
    }
    
    // Create simple Genesis metadata with embedded image
    const genesisMetadata = JSON.stringify({
      "name": "Blockticity Genesis Certificate #001",
      "description": "The historic first Certificate of Authenticity marking the beginning of trustless trade at scale on Blockticity L1. This Genesis NFT represents the founding moment of decentralized trade authentication, implementing ASTM D8558 standards.",
      "image": "data:image/svg+xml;base64," + Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="background: #f5f5f5;">
          <defs>
            <style>
              .title { font-family: Arial, sans-serif; font-size: 48px; font-weight: bold; text-anchor: middle; }
              .subtitle { font-family: Arial, sans-serif; font-size: 24px; text-anchor: middle; }
              .coa-id { font-family: Arial, sans-serif; font-size: 36px; font-weight: bold; text-anchor: middle; }
              .verified { font-family: Arial, sans-serif; font-size: 20px; text-anchor: middle; }
            </style>
          </defs>
          
          <!-- Outer circle -->
          <circle cx="500" cy="500" r="450" fill="white" stroke="#000" stroke-width="8"/>
          
          <!-- Blockticity text arc -->
          <path id="top-arc" d="M 150,500 A 350,350 0 0,1 850,500" fill="none"/>
          <text class="title" fill="#000">
            <textPath href="#top-arc" startOffset="50%">BLOCKTICITY VERIFIED</textPath>
          </text>
          
          <!-- Central hexagon -->
          <polygon points="500,200 650,275 650,425 500,500 350,425 350,275" 
                   fill="none" stroke="#000" stroke-width="6"/>
          
          <!-- Inner design -->
          <rect x="400" y="300" width="200" height="120" fill="none" stroke="#000" stroke-width="4"/>
          <line x1="420" y1="320" x2="580" y2="320" stroke="#000" stroke-width="2"/>
          <line x1="420" y1="360" x2="580" y2="360" stroke="#000" stroke-width="2"/>
          <line x1="420" y1="400" x2="580" y2="400" stroke="#000" stroke-width="2"/>
          
          <!-- COA #001 text -->
          <text x="500" y="720" class="coa-id" fill="#000">COA #001</text>
          
          <!-- Bottom text -->
          <text x="500" y="780" class="verified" fill="#000">GENESIS CERTIFICATE</text>
          <text x="500" y="820" class="verified" fill="#000">ASTM D8558 COMPLIANT</text>
          <text x="500" y="860" class="verified" fill="#000">BLOCKTICITY L1 MAINNET</text>
        </svg>
      `).toString('base64'),
      "external_url": "https://blockticity.io/coa/genesis-001",
      "attributes": [
        {"trait_type": "Certificate ID", "value": "COA #001"},
        {"trait_type": "Certificate Type", "value": "Genesis Certificate"},
        {"trait_type": "Date Issued", "value": "2025-06-06"},
        {"trait_type": "Network", "value": "Blockticity L1"},
        {"trait_type": "Chain ID", "value": "28530"},
        {"trait_type": "Historic Significance", "value": "First COA on Blockticity L1"},
        {"trait_type": "Mission", "value": "Trustless Trade at Scale"},
        {"trait_type": "Standard", "value": "ASTM D8558"},
        {"trait_type": "Contract", "value": process.env.CONTRACT_ADDRESS},
        {"trait_type": "Rarity", "value": "Genesis (1 of 1)"}
      ]
    });
    
    const metadataURI = "data:application/json;base64," + Buffer.from(genesisMetadata).toString('base64');
    
    console.log("Genesis Metadata URI created (embedded)");
    console.log(`Metadata length: ${metadataURI.length} characters\n`);
    
    // Estimate gas
    console.log("Estimating gas for mint...");
    const gasEstimate = await contract.mintURI.estimateGas(recipient, metadataURI);
    console.log(`Gas estimate: ${gasEstimate.toString()}`);
    
    // Get gas price
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const estimatedCost = gasEstimate * gasPrice;
    
    console.log(`Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`Estimated cost: ${ethers.formatEther(estimatedCost)} BTIC`);
    
    console.log(`\n${colors.yellow}🎉 READY TO MINT GENESIS COA #001 🎉${colors.reset}`);
    console.log("This is a historic moment for Blockticity!");
    console.log("The first tamper-evident certificate on Blockticity L1");
    console.log("Enabling trustless trade at scale...");
    console.log("\nPress Ctrl+C to cancel, or wait 5 seconds to proceed...\n");
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Mint the Genesis NFT
    console.log(`${colors.cyan}Executing Genesis mint...${colors.reset}`);
    const tx = await contract.mintURI(recipient, metadataURI, {
      gasLimit: gasEstimate * 120n / 100n, // 20% buffer
      gasPrice: gasPrice,
    });
    
    console.log(`${colors.bright}🚀 Transaction submitted!${colors.reset}`);
    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log(`${colors.green}✅ Transaction confirmed!${colors.reset}`);
    console.log(`Block number: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    // Create success log
    const genesisLog = {
      title: "🎉 BLOCKTICITY GENESIS MOMENT 🎉",
      description: "Historic first COA minted on Blockticity L1 Mainnet",
      timestamp: new Date().toISOString(),
      blockchain: {
        network: "Blockticity L1 Mainnet",
        chainId: 28530,
        contract: process.env.CONTRACT_ADDRESS,
      },
      nft: {
        name: "Blockticity Genesis Certificate #001",
        description: "First tamper-evident certificate enabling trustless trade at scale",
        metadataType: "Embedded SVG"
      },
      transaction: {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei",
        cost: ethers.formatEther(estimatedCost) + " BTIC"
      },
      explorer: {
        transaction: `https://subnets.avax.network/btic/tx/${tx.hash}`,
        contract: `https://subnets.avax.network/btic/address/${process.env.CONTRACT_ADDRESS}`,
      },
      significance: {
        mission: "Trustless Trade at Scale",
        standard: "ASTM D8558",
        goal: "750,000+ COAs by June 2025",
        program: "Avalanche Fintech AI Innovation Grant",
        milestone: "Genesis NFT - Foundation for all future COAs"
      }
    };
    
    // Save log
    const fs = require("fs");
    const path = require("path");
    const logPath = path.join(__dirname, "..", "GENESIS_MINT_SUCCESS.json");
    fs.writeFileSync(logPath, JSON.stringify(genesisLog, null, 2));
    
    console.log(`\n${colors.bright}${colors.magenta}🌟 GENESIS MINT COMPLETE! 🌟${colors.reset}`);
    console.log("=" .repeat(60));
    console.log(`${colors.green}Blockticity Genesis COA #001 Successfully Minted!${colors.reset}`);
    console.log(`Transaction: ${tx.hash}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`\n${colors.cyan}Explorer Links:${colors.reset}`);
    console.log(`Transaction: https://subnets.avax.network/btic/tx/${tx.hash}`);
    console.log(`Contract: https://subnets.avax.network/btic/address/${process.env.CONTRACT_ADDRESS}`);
    console.log(`\n${colors.yellow}Historic Achievement:${colors.reset}`);
    console.log("✓ First Certificate of Authenticity on Blockticity L1");
    console.log("✓ ASTM D8558 compliant blockchain certificate");
    console.log("✓ Foundation for 750,000+ COAs by June 2025");
    console.log("✓ Enabling trustless trade at scale");
    console.log("=" .repeat(60));
    console.log(`\n${colors.green}Log saved to: GENESIS_MINT_SUCCESS.json${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}Genesis mint failed:${colors.reset}`, error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});