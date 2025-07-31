const { ethers } = require("hardhat");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
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

async function uploadToPinata(filePath, filename) {
  console.log(`${colors.cyan}Uploading ${filename} to IPFS...${colors.reset}`);
  
  try {
    const data = new FormData();
    data.append("file", fs.createReadStream(filePath), { filename });
    data.append("pinataOptions", JSON.stringify({
      cidVersion: 1,
    }));
    data.append("pinataMetadata", JSON.stringify({
      name: filename,
      keyvalues: {
        project: "Blockticity",
        type: "Genesis COA",
        historic: "true"
      }
    }));

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        headers: {
          ...data.getHeaders(),
          pinata_api_key: process.env.PINATA_API_KEY,
          pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
        },
        maxBodyLength: Infinity,
      }
    );

    const ipfsHash = response.data.IpfsHash;
    console.log(`${colors.green}✓ Uploaded successfully!${colors.reset}`);
    console.log(`IPFS Hash: ${ipfsHash}`);
    console.log(`Gateway URL: https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    
    return ipfsHash;
  } catch (error) {
    console.error(`${colors.red}Upload failed:${colors.reset}`, error.response?.data || error.message);
    throw error;
  }
}

async function updateMetadataWithImageHash(imageHash) {
  console.log(`${colors.cyan}Updating metadata with image hash...${colors.reset}`);
  
  const metadataPath = path.join(__dirname, "..", "genesis_metadata.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  
  // Update image hash
  metadata.image = `ipfs://${imageHash}`;
  
  // Add timestamp
  metadata.attributes.push({
    trait_type: "Minted Timestamp",
    value: new Date().toISOString()
  });
  
  // Save updated metadata
  const updatedMetadataPath = path.join(__dirname, "..", "genesis_metadata_final.json");
  fs.writeFileSync(updatedMetadataPath, JSON.stringify(metadata, null, 2));
  
  console.log(`${colors.green}✓ Metadata updated!${colors.reset}`);
  return updatedMetadataPath;
}

async function mintGenesisNFT(metadataHash, recipient) {
  console.log(`${colors.cyan}Minting Genesis NFT...${colors.reset}`);
  
  const [signer] = await ethers.getSigners();
  const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
  const contract = BlockticityLayerZero.attach(process.env.CONTRACT_ADDRESS);
  
  const metadataURI = `ipfs://${metadataHash}`;
  
  console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Metadata URI: ${metadataURI}`);
  
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
  
  return { tx, receipt };
}

async function logHistoricMoment(imageHash, metadataHash, mintResult) {
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
      tokenId: 1, // First token
      name: "Blockticity Genesis Certificate #001",
      recipient: mintResult.tx.to,
    },
    ipfs: {
      imageHash: imageHash,
      metadataHash: metadataHash,
      imageUrl: `https://gateway.pinata.cloud/ipfs/${imageHash}`,
      metadataUrl: `https://gateway.pinata.cloud/ipfs/${metadataHash}`,
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
  console.log(`Transaction: ${mintResult.tx.hash}`);
  console.log(`Block Number: ${mintResult.receipt.blockNumber}`);
  console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
  console.log(`IPFS Image: ${imageHash}`);
  console.log(`IPFS Metadata: ${metadataHash}`);
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
    
    // Verify environment
    if (!process.env.CONTRACT_ADDRESS) {
      throw new Error("CONTRACT_ADDRESS not set in .env");
    }
    if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
      throw new Error("Pinata API keys not set");
    }
    
    const [signer] = await ethers.getSigners();
    const recipient = process.env.MAINNET_OWNER_ADDRESS || signer.address;
    
    console.log(`Network: Blockticity L1 (Chain ID: 28530)`);
    console.log(`Contract: ${process.env.CONTRACT_ADDRESS}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Deployer: ${signer.address}\n`);
    
    // Step 1: Upload image to IPFS
    const imagePath = path.join(__dirname, "..", "genesis_coa_001.png");
    const imageHash = await uploadToPinata(imagePath, "blockticity_genesis_coa_001.png");
    
    // Step 2: Update metadata with image hash
    const finalMetadataPath = await updateMetadataWithImageHash(imageHash);
    
    // Step 3: Upload metadata to IPFS
    const metadataHash = await uploadToPinata(finalMetadataPath, "blockticity_genesis_metadata.json");
    
    // Step 4: Mint the Genesis NFT
    const mintResult = await mintGenesisNFT(metadataHash, recipient);
    
    // Step 5: Log this historic moment
    const genesisLog = await logHistoricMoment(imageHash, metadataHash, mintResult);
    
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