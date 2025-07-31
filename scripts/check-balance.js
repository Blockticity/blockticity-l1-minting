const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("\nBlockticity L1 Account Information");
  console.log("==================================");
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${network.chainId}`);
  
  // Get account info
  console.log(`\nAccount: ${signer.address}`);
  
  // Get BTIC balance
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} BTIC`);
  
  // Get current gas price
  const feeData = await ethers.provider.getFeeData();
  console.log(`\nGas Price: ${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`);
  
  // Estimate deployment cost
  const deployGasEstimate = 3000000n; // Approximate gas for contract deployment
  const deploymentCost = deployGasEstimate * feeData.gasPrice;
  console.log(`\nEstimated deployment cost: ${ethers.formatEther(deploymentCost)} BTIC`);
  
  // Check if balance is sufficient
  if (balance > deploymentCost) {
    console.log(`✅ Sufficient balance for deployment`);
  } else {
    console.log(`❌ Insufficient balance. Need at least ${ethers.formatEther(deploymentCost)} BTIC`);
  }
  
  // Show contract address if set
  if (process.env.CONTRACT_ADDRESS) {
    console.log(`\nContract Address: ${process.env.CONTRACT_ADDRESS}`);
    
    // Check if contract exists
    const code = await ethers.provider.getCode(process.env.CONTRACT_ADDRESS);
    if (code !== "0x") {
      console.log("✅ Contract deployed at this address");
    } else {
      console.log("❌ No contract found at this address");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});