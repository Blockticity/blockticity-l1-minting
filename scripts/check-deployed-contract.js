const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  console.log(`Checking contract at: ${contractAddress}`);
  
  // Check if contract exists
  const code = await ethers.provider.getCode(contractAddress);
  console.log(`Contract code exists: ${code !== '0x'}`);
  console.log(`Code length: ${code.length} characters`);
  
  if (code === '0x') {
    console.log("No contract deployed at this address!");
    return;
  }
  
  // Try to call the contract directly using low-level calls
  try {
    // name() function selector: 0x06fdde03
    const nameCall = await ethers.provider.call({
      to: contractAddress,
      data: "0x06fdde03"
    });
    console.log("Name call result:", nameCall);
    
    if (nameCall !== "0x") {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], nameCall);
      console.log("Contract name:", decoded[0]);
    }
  } catch (error) {
    console.log("Name call failed:", error.message);
  }
  
  try {
    // symbol() function selector: 0x95d89b41
    const symbolCall = await ethers.provider.call({
      to: contractAddress,
      data: "0x95d89b41"
    });
    console.log("Symbol call result:", symbolCall);
    
    if (symbolCall !== "0x") {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], symbolCall);
      console.log("Contract symbol:", decoded[0]);
    }
  } catch (error) {
    console.log("Symbol call failed:", error.message);
  }
  
  try {
    // owner() function selector: 0x8da5cb5b
    const ownerCall = await ethers.provider.call({
      to: contractAddress,
      data: "0x8da5cb5b"
    });
    console.log("Owner call result:", ownerCall);
    
    if (ownerCall !== "0x") {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["address"], ownerCall);
      console.log("Contract owner:", decoded[0]);
    }
  } catch (error) {
    console.log("Owner call failed:", error.message);
  }
  
  // Let's check the transaction that deployed this contract
  console.log("\nLooking up deployment transaction...");
  try {
    // This is the deployment transaction from the logs
    const deployTx = "0x3c6d237ed2e2f0c49b2c0260bb611bfa45ddb922fce9c6bf8173b01d69689620";
    const receipt = await ethers.provider.getTransactionReceipt(deployTx);
    console.log("Deployment transaction found!");
    console.log("Contract address from receipt:", receipt.contractAddress);
    console.log("Status:", receipt.status);
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.log("Could not find deployment transaction:", error.message);
  }
}

main().catch(console.error);