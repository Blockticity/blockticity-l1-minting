const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

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

async function createMetadataWithKnownImageHash() {
  console.log(`${colors.cyan}Creating Genesis metadata...${colors.reset}`);
  
  // For now, I'll use a placeholder IPFS hash that you can update after manual upload
  const metadata = {
    "name": "Blockticity Genesis Certificate #001",
    "description": "The historic first Certificate of Authenticity marking the beginning of trustless trade at scale on Blockticity L1. This Genesis NFT represents the founding moment of decentralized trade authentication, implementing ASTM D8558 standards for blockchain-based certificates. COA #001 establishes the foundation for 750,000+ certificates to follow, enabling verifiable, tamper-evident trade documentation without relying on centralized authorities.",
    "image": "ipfs://QmYOUR_IMAGE_HASH_HERE", // We'll update this after manual upload
    "external_url": "https://blockticity.io/coa/genesis-001",
    "attributes": [
      {
        "trait_type": "Certificate ID",
        "value": "COA #001"
      },
      {
        "trait_type": "Certificate Type",
        "value": "Genesis Certificate"
      },
      {
        "trait_type": "Date Issued",
        "value": "2025-06-06"
      },
      {
        "trait_type": "Minted Timestamp",
        "value": new Date().toISOString()
      },
      {
        "trait_type": "Blockchain Standard",
        "value": "ASTM D8558"
      },
      {
        "trait_type": "Network",
        "value": "Blockticity L1"
      },
      {
        "trait_type": "Chain ID",
        "value": "28530"
      },
      {
        "trait_type": "Historic Significance",
        "value": "First COA on Blockticity L1"
      },
      {
        "trait_type": "Mission",
        "value": "Trustless Trade at Scale"
      },
      {
        "trait_type": "Contract Address",
        "value": "0x4c87A2f1644A27e42947C81FBe912528C7ACc62a"
      },
      {
        "trait_type": "Verification Status",
        "value": "Blockticity Verified"
      },
      {
        "trait_type": "Grant Program",
        "value": "Avalanche Fintech AI Innovation"
      },
      {
        "trait_type": "Standards Contributor",
        "value": "ASTM D8558"
      },
      {
        "trait_type": "Token Standard",
        "value": "ERC-721"
      },
      {
        "trait_type": "Rarity",
        "value": "Genesis (1 of 1)"
      }
    ],
    "properties": {
      "category": "Certificate of Authenticity",
      "creator": "Blockticity",
      "blockchain": "Blockticity L1",
      "genesis": true,
      "astm_compliant": true,
      "layer_zero_ready": true
    },
    "background_color": "FFFFFF",
    "collection": {
      "name": "Blockticity Certificates of Authenticity",
      "family": "Blockticity COA"
    }
  };
  
  const metadataPath = path.join(__dirname, "..", "genesis_metadata_ready.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log(`${colors.green}✓ Genesis metadata created!${colors.reset}`);
  console.log(`Saved to: ${metadataPath}`);
  
  return metadataPath;
}

async function mintWithDirectHash(metadataURI, recipient) {
  console.log(`${colors.cyan}Minting Genesis NFT with direct metadata URI...${colors.reset}`);
  
  const [signer] = await ethers.getSigners();
  const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
  const contract = BlockticityLayerZero.attach(process.env.CONTRACT_ADDRESS);
  
  console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Metadata URI: ${metadataURI}`);
  
  // Check current token ID
  const currentTokenId = await contract.currentTokenId();
  console.log(`Current Token ID: ${currentTokenId}`);
  console.log(`Next Token ID will be: ${Number(currentTokenId) + 1}`);
  
  // Estimate gas
  const gasEstimate = await contract.mintURI.estimateGas(recipient, metadataURI);
  console.log(`Gas estimate: ${gasEstimate.toString()}`);
  
  // Get gas price
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const estimatedCost = gasEstimate * gasPrice;
  
  console.log(`Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`Estimated cost: ${ethers.formatEther(estimatedCost)} BTIC`);
  
  console.log(`\n${colors.yellow}🎉 MINTING GENESIS COA #001 🎉${colors.reset}`);
  console.log("This is a historic moment for Blockticity!");
  console.log("Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n");
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Mint the NFT
  const tx = await contract.mintURI(recipient, metadataURI, {
    gasLimit: gasEstimate * 120n / 100n, // 20% buffer
    gasPrice: gasPrice,
  });
  
  console.log(`${colors.bright}Transaction submitted!${colors.reset}`);
  console.log(`Transaction hash: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  
  const receipt = await tx.wait();
  
  console.log(`${colors.green}✓ Transaction confirmed!${colors.reset}`);
  console.log(`Block number: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  
  // Get the new token ID
  const newTokenId = await contract.currentTokenId();
  console.log(`New Token ID: ${newTokenId}`);
  
  return { tx, receipt, tokenId: newTokenId };
}

async function logGenesisSuccess(mintResult, metadataURI) {
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
      tokenId: mintResult.tokenId.toString(),
      name: "Blockticity Genesis Certificate #001",
      metadataURI: metadataURI,
    },
    transaction: {
      hash: mintResult.tx.hash,
      blockNumber: mintResult.receipt.blockNumber,
      gasUsed: mintResult.receipt.gasUsed.toString(),
      status: mintResult.receipt.status,
    },
    explorer: {
      transaction: `https://subnets.avax.network/btic/tx/${mintResult.tx.hash}`,
      contract: `https://subnets.avax.network/btic/address/${process.env.CONTRACT_ADDRESS}`,
    },
    significance: {
      mission: "Trustless Trade at Scale",
      standard: "ASTM D8558",
      goal: "750,000+ COAs by June 2025",
      program: "Avalanche Fintech AI Innovation Grant",
    }
  };
  
  // Save to file
  const logPath = path.join(__dirname, "..", "GENESIS_MINT_LOG.json");
  fs.writeFileSync(logPath, JSON.stringify(genesisLog, null, 2));
  
  console.log(`\n${colors.bright}${colors.magenta}🌟 GENESIS MINT COMPLETE! 🌟${colors.reset}`);
  console.log("=" .repeat(60));
  console.log(`Genesis COA #001 Successfully Minted!`);
  console.log(`Token ID: ${mintResult.tokenId}`);
  console.log(`Transaction: ${mintResult.tx.hash}`);
  console.log(`Block Number: ${mintResult.receipt.blockNumber}`);
  console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
  console.log(`Metadata URI: ${metadataURI}`);
  console.log(`\nExplorer Links:`);
  console.log(`Transaction: https://subnets.avax.network/btic/tx/${mintResult.tx.hash}`);
  console.log(`Contract: https://subnets.avax.network/btic/address/${process.env.CONTRACT_ADDRESS}`);
  console.log(`\nThis historic moment marks the beginning of trustless trade at scale!`);
  console.log("=" .repeat(60));
  
  return genesisLog;
}

async function main() {
  try {
    console.log(`${colors.bright}${colors.blue}🚀 BLOCKTICITY GENESIS MINT 🚀${colors.reset}`);
    console.log("=" .repeat(50));
    console.log("Minting the first COA on Blockticity L1 Mainnet");
    console.log("Historic significance: Beginning of trustless trade at scale\n");
    
    const [signer] = await ethers.getSigners();
    const recipient = process.env.MAINNET_OWNER_ADDRESS || signer.address;
    
    console.log(`Network: Blockticity L1 (Chain ID: 28530)`);
    console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Deployer: ${signer.address}\n`);
    
    // For this historic mint, we'll use a simple metadata URI
    // You can upload the image and metadata to IPFS manually later if needed
    const simpleMetadataURI = "data:application/json;base64," + Buffer.from(JSON.stringify({
      "name": "Blockticity Genesis Certificate #001",
      "description": "The historic first Certificate of Authenticity marking the beginning of trustless trade at scale on Blockticity L1.",
      "image": "data:image/svg+xml;base64," + Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" style="background: white;">
          <circle cx="200" cy="200" r="180" fill="none" stroke="black" stroke-width="4"/>
          <text x="200" y="120" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold">BLOCKTICITY</text>
          <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="16">VERIFIED</text>
          <rect x="150" y="170" width="100" height="60" fill="none" stroke="black" stroke-width="3"/>
          <text x="200" y="210" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold">COA #001</text>
          <text x="200" y="280" text-anchor="middle" font-family="Arial" font-size="14">GENESIS</text>
          <text x="200" y="300" text-anchor="middle" font-family="Arial" font-size="12">ASTM D8558</text>
        </svg>
      `).toString('base64'),
      "attributes": [
        {"trait_type": "Certificate ID", "value": "COA #001"},
        {"trait_type": "Certificate Type", "value": "Genesis Certificate"},
        {"trait_type": "Network", "value": "Blockticity L1"},
        {"trait_type": "Historic Significance", "value": "First COA on Blockticity L1"},
        {"trait_type": "Mission", "value": "Trustless Trade at Scale"}
      ]
    })).toString('base64');
    
    console.log(`${colors.yellow}Using embedded metadata for this historic mint${colors.reset}`);
    console.log("(You can update with IPFS metadata later)\n");
    
    // Mint the Genesis NFT
    const mintResult = await mintWithDirectHash(simpleMetadataURI, recipient);
    
    // Log this historic moment
    const genesisLog = await logGenesisSuccess(mintResult, simpleMetadataURI);
    
    console.log(`\n${colors.green}Genesis mint documentation saved to GENESIS_MINT_LOG.json${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}Genesis mint failed:${colors.reset}`, error.message);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});