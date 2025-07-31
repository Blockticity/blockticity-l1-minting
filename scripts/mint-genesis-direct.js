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
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const recipient = process.env.MAINNET_OWNER_ADDRESS || signer.address;
    
    console.log(`Network: Blockticity L1 (Chain ID: 28530)`);
    console.log(`Contract: ${contractAddress}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Deployer: ${signer.address}\n`);
    
    // Simple embedded Genesis metadata with the actual Blockticity COA image
    const genesisMetadata = {
      "name": "Blockticity Genesis Certificate #001",
      "description": "The historic first Certificate of Authenticity marking the beginning of trustless trade at scale on Blockticity L1. This Genesis NFT represents the founding moment of decentralized trade authentication, implementing ASTM D8558 standards for blockchain-based certificates. COA #001 establishes the foundation for 750,000+ certificates to follow, enabling verifiable, tamper-evident trade documentation without relying on centralized authorities.",
      "image": "data:image/svg+xml;base64," + Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="background: #f8f9fa;">
          <defs>
            <style>
              .main-circle { fill: white; stroke: #000; stroke-width: 8; }
              .text-path { font-family: 'Arial Black', Arial, sans-serif; font-size: 48px; font-weight: 900; text-anchor: middle; }
              .coa-text { font-family: 'Arial Black', Arial, sans-serif; font-size: 56px; font-weight: 900; text-anchor: middle; }
              .genesis-text { font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; text-anchor: middle; }
              .small-text { font-family: Arial, sans-serif; font-size: 18px; text-anchor: middle; }
            </style>
          </defs>
          
          <!-- Main circle -->
          <circle cx="500" cy="500" r="450" class="main-circle"/>
          
          <!-- Blockticity Verified text around circle -->
          <path id="circle-path" d="M 150,500 A 350,350 0 1,1 850,500 A 350,350 0 1,1 150,500" fill="none"/>
          <text class="text-path" fill="#000">
            <textPath href="#circle-path" startOffset="25%">BLOCKTICITY VERIFIED</textPath>
          </text>
          
          <!-- Central hexagon design -->
          <polygon points="500,200 650,275 650,425 500,500 350,425 350,275" 
                   fill="none" stroke="#000" stroke-width="8"/>
          
          <!-- Inner hexagon -->
          <polygon points="500,250 600,300 600,400 500,450 400,400 400,300" 
                   fill="none" stroke="#000" stroke-width="4"/>
          
          <!-- COA #001 text -->
          <text x="500" y="650" class="coa-text" fill="#000">COA #001</text>
          
          <!-- Bottom text -->
          <text x="500" y="750" class="genesis-text" fill="#000">GENESIS CERTIFICATE</text>
          <text x="500" y="790" class="small-text" fill="#000">ASTM D8558 COMPLIANT</text>
          <text x="500" y="820" class="small-text" fill="#000">BLOCKTICITY L1 MAINNET</text>
          <text x="500" y="850" class="small-text" fill="#000">TRUSTLESS TRADE AT SCALE</text>
          
          <!-- Verification dots -->
          <circle cx="150" cy="500" r="8" fill="#000"/>
          <circle cx="850" cy="500" r="8" fill="#000"/>
        </svg>
      `).toString('base64'),
      "external_url": "https://blockticity.io/coa/genesis-001",
      "attributes": [
        {"trait_type": "Certificate ID", "value": "COA #001"},
        {"trait_type": "Certificate Type", "value": "Genesis Certificate"},
        {"trait_type": "Date Issued", "value": "2025-06-07"},
        {"trait_type": "Network", "value": "Blockticity L1"},
        {"trait_type": "Chain ID", "value": "28530"},
        {"trait_type": "Historic Significance", "value": "First COA on Blockticity L1"},
        {"trait_type": "Mission", "value": "Trustless Trade at Scale"},
        {"trait_type": "Standard", "value": "ASTM D8558"},
        {"trait_type": "Contract", "value": contractAddress},
        {"trait_type": "Rarity", "value": "Genesis (1 of 1)"},
        {"trait_type": "Grant Program", "value": "Avalanche Fintech AI Innovation"},
        {"trait_type": "Verification Status", "value": "Blockticity Verified"},
        {"trait_type": "Minted Timestamp", "value": new Date().toISOString()}
      ],
      "properties": {
        "category": "Certificate of Authenticity",
        "creator": "Blockticity",
        "blockchain": "Blockticity L1",
        "genesis": true,
        "astm_compliant": true
      }
    };
    
    const metadataURI = "data:application/json;base64," + Buffer.from(JSON.stringify(genesisMetadata)).toString('base64');
    
    console.log("✅ Genesis metadata created (embedded SVG)");
    console.log(`📏 Metadata URI length: ${metadataURI.length} characters\n`);
    
    // Connect to contract
    const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
    const contract = BlockticityLayerZero.attach(contractAddress);
    
    // Estimate gas
    console.log("⛽ Estimating gas for Genesis mint...");
    const gasEstimate = await contract.mintURI.estimateGas(recipient, metadataURI);
    console.log(`Gas estimate: ${gasEstimate.toString()}`);
    
    // Get gas price
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const estimatedCost = gasEstimate * gasPrice;
    
    console.log(`Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`Estimated cost: ${ethers.formatEther(estimatedCost)} BTIC`);
    
    console.log(`\n${colors.yellow}🎉 READY TO MINT GENESIS COA #001 🎉${colors.reset}`);
    console.log(`${colors.bright}This is a historic moment for Blockticity!${colors.reset}`);
    console.log("🏛️  The first tamper-evident certificate on Blockticity L1");
    console.log("🌍  Enabling trustless trade at scale globally");
    console.log("📜  ASTM D8558 compliant blockchain certificate");
    console.log("🚀  Foundation for 750,000+ COAs by June 2025");
    console.log("\nPress Ctrl+C to cancel, or wait 3 seconds to proceed...\n");
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mint the Genesis NFT
    console.log(`${colors.cyan}🔨 Executing Genesis mint transaction...${colors.reset}`);
    const tx = await contract.mintURI(recipient, metadataURI, {
      gasLimit: gasEstimate * 120n / 100n, // 20% buffer
    });
    
    console.log(`${colors.bright}🚀 Transaction submitted!${colors.reset}`);
    console.log(`📝 Transaction hash: ${tx.hash}`);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log(`${colors.green}✅ Transaction confirmed!${colors.reset}`);
    console.log(`📦 Block number: ${receipt.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    // Get the token ID from events
    let tokenId = "1"; // First token
    try {
      // Try to get current token ID if function exists
      const currentTokenId = await contract.currentTokenId();
      tokenId = currentTokenId.toString();
    } catch (error) {
      // Function might not exist in simple version
    }
    
    // Create historic log
    const genesisLog = {
      title: "🎉 BLOCKTICITY GENESIS MOMENT 🎉",
      description: "Historic first COA minted on Blockticity L1 Mainnet",
      timestamp: new Date().toISOString(),
      blockchain: {
        network: "Blockticity L1 Mainnet",
        chainId: 28530,
        contract: contractAddress,
      },
      nft: {
        tokenId: tokenId,
        name: "Blockticity Genesis Certificate #001",
        description: "First tamper-evident certificate enabling trustless trade at scale",
        recipient: recipient,
        metadataType: "Embedded SVG"
      },
      transaction: {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: ethers.formatUnits(gasPrice, "gwei") + " gwei",
        cost: ethers.formatEther(receipt.gasUsed * gasPrice) + " BTIC"
      },
      explorer: {
        transaction: `https://subnets.avax.network/btic/tx/${tx.hash}`,
        contract: `https://subnets.avax.network/btic/address/${contractAddress}`,
      },
      significance: {
        mission: "Trustless Trade at Scale",
        standard: "ASTM D8558",
        goal: "750,000+ COAs by June 2025",
        program: "Avalanche Fintech AI Innovation Grant",
        milestone: "Genesis NFT - Foundation for all future COAs",
        achievement: "First blockchain certificate on dedicated Blockticity L1"
      }
    };
    
    // Save log
    const fs = require("fs");
    const path = require("path");
    const logPath = path.join(__dirname, "..", "GENESIS_MINT_SUCCESS.json");
    fs.writeFileSync(logPath, JSON.stringify(genesisLog, null, 2));
    
    console.log(`\n${colors.bright}${colors.magenta}🌟 GENESIS MINT COMPLETE! 🌟${colors.reset}`);
    console.log("=" .repeat(70));
    console.log(`${colors.green}🏆 Blockticity Genesis COA #001 Successfully Minted!${colors.reset}`);
    console.log(`🎯 Token ID: ${tokenId}`);
    console.log(`📝 Transaction: ${tx.hash}`);
    console.log(`📦 Block: ${receipt.blockNumber}`);
    console.log(`🏠 Contract: ${contractAddress}`);
    console.log(`👤 Owner: ${recipient}`);
    console.log(`\n${colors.cyan}🔗 Explorer Links:${colors.reset}`);
    console.log(`Transaction: https://subnets.avax.network/btic/tx/${tx.hash}`);
    console.log(`Contract: https://subnets.avax.network/btic/address/${contractAddress}`);
    console.log(`\n${colors.yellow}🎖️  Historic Achievement:${colors.reset}`);
    console.log("✅ First Certificate of Authenticity on Blockticity L1");
    console.log("✅ ASTM D8558 compliant blockchain certificate");
    console.log("✅ Foundation for 750,000+ COAs by June 2025");
    console.log("✅ Enabling trustless trade at scale globally");
    console.log("✅ Beginning of decentralized trade authentication");
    console.log("=" .repeat(70));
    console.log(`\n${colors.green}📊 Log saved to: GENESIS_MINT_SUCCESS.json${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}💥 Genesis mint failed:${colors.reset}`, error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    if (error.transaction) {
      console.error(`Transaction: ${error.transaction.hash}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});