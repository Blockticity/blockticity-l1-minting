const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x28568c9f536f0c962878521d68ea89b947c8d99e56e91c9afd33efddf61826ff";
  
  console.log(`Checking transaction: ${txHash}`);
  
  try {
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    if (receipt) {
      console.log("Transaction found!");
      console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
      console.log("Block number:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());
      console.log("Contract address:", receipt.contractAddress);
      
      if (receipt.contractAddress) {
        const code = await ethers.provider.getCode(receipt.contractAddress);
        console.log("Contract deployed:", code !== "0x");
        console.log("Code length:", code.length);
      }
    } else {
      console.log("Transaction not found - might still be pending");
      
      // Try to get the transaction itself
      const tx = await ethers.provider.getTransaction(txHash);
      if (tx) {
        console.log("Transaction exists but not mined yet");
        console.log("Block number:", tx.blockNumber);
        console.log("Nonce:", tx.nonce);
      } else {
        console.log("Transaction not found at all");
      }
    }
  } catch (error) {
    console.error("Error checking transaction:", error.message);
  }
}

main().catch(console.error);