// scripts/bulkMintFromCSV.js

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  // Load signer
  const [signer] = await ethers.getSigners();

  // Load your deployed contract - use environment variable or default to mainnet
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.MAINNET_CONTRACT || "0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926";
  const contractABI = require("../artifacts/contracts/BlockticityLayerZero.sol/BlockticityLayerZero.json").abi;
  const contract = new ethers.Contract(contractAddress, contractABI, signer);

  // Load CSV
  const csvPath = path.join(__dirname, "../pia_bulk_mint_test_batch.csv");
  const file = fs.readFileSync(csvPath, "utf8");
  const lines = file.trim().split("\n").slice(1); // skip header

  for (let i = 0; i < lines.length; i++) {
    const [wallet, uri] = lines[i].split(",");

    try {
      console.log(`🔁 Minting to ${wallet} with URI: ${uri}`);
      const tx = await contract.mintURI(wallet, uri.trim());
      console.log(`⏳ Waiting for tx: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Success for ${wallet}`);
    } catch (err) {
      console.error(`❌ Error minting to ${wallet}:`, err.message || err);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error in script:", err);
  process.exitCode = 1;
});
