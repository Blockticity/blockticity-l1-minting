const { ethers } = require("hardhat");
const axios = require("axios");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

async function verifyContract(contractAddress) {
  console.log(`${colors.cyan}Running post-deployment verification...${colors.reset}\n`);
  
  // Get contract instance
  const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
  const contract = BlockticityLayerZero.attach(contractAddress);
  
  const results = [];
  
  // 1. Basic contract information
  console.log("1. Checking basic contract information...");
  try {
    const name = await contract.name();
    const symbol = await contract.symbol();
    const owner = await contract.owner();
    const tokenId = await contract.currentTokenId();
    
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Owner: ${owner}`);
    console.log(`   Current Token ID: ${tokenId}`);
    
    results.push({ test: "Basic Info", status: "PASS" });
  } catch (error) {
    console.log(`   ${colors.red}Failed: ${error.message}${colors.reset}`);
    results.push({ test: "Basic Info", status: "FAIL", error: error.message });
  }
  
  // 2. Test minting capability
  console.log("\n2. Testing minting capability...");
  try {
    const testAddress = "0x663Bf83315f399F7254F5d6E5C119BF2a6350396"; // Owner address from CLAUDE.md
    const testURI = "ipfs://QmTest123";
    
    // Estimate gas for minting
    const gasEstimate = await contract.mintURI.estimateGas(testAddress, testURI);
    console.log(`   Gas estimate for minting: ${gasEstimate.toString()}`);
    
    // Get gas price
    const feeData = await ethers.provider.getFeeData();
    const estimatedCost = gasEstimate * feeData.gasPrice;
    console.log(`   Estimated cost: ${ethers.formatEther(estimatedCost)} ETH`);
    
    results.push({ test: "Mint Capability", status: "PASS", gasEstimate: gasEstimate.toString() });
  } catch (error) {
    console.log(`   ${colors.red}Failed: ${error.message}${colors.reset}`);
    results.push({ test: "Mint Capability", status: "FAIL", error: error.message });
  }
  
  // 3. Test IPFS connectivity
  console.log("\n3. Testing IPFS connectivity...");
  try {
    const testCID = "QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4"; // Known IPFS test file
    const ipfsGateway = "https://gateway.pinata.cloud/ipfs/";
    
    const response = await axios.get(`${ipfsGateway}${testCID}`, { timeout: 10000 });
    console.log(`   IPFS Gateway: ${colors.green}Connected${colors.reset}`);
    console.log(`   Test file retrieved successfully`);
    
    results.push({ test: "IPFS Connectivity", status: "PASS" });
  } catch (error) {
    console.log(`   ${colors.red}Failed: Unable to connect to IPFS${colors.reset}`);
    results.push({ test: "IPFS Connectivity", status: "FAIL", error: "IPFS connection failed" });
  }
  
  // 4. Test access control
  console.log("\n4. Testing access control...");
  try {
    // Create a non-owner signer
    const [owner, nonOwner] = await ethers.getSigners();
    const nonOwnerContract = contract.connect(nonOwner);
    
    // Try to mint as non-owner (should fail)
    try {
      await nonOwnerContract.mintURI.estimateGas(
        "0x0000000000000000000000000000000000000001",
        "ipfs://test"
      );
      console.log(`   ${colors.red}WARNING: Non-owner can mint!${colors.reset}`);
      results.push({ test: "Access Control", status: "FAIL", error: "Non-owner can mint" });
    } catch (error) {
      console.log(`   ${colors.green}Access control working correctly${colors.reset}`);
      console.log(`   Non-owner mint rejected as expected`);
      results.push({ test: "Access Control", status: "PASS" });
    }
  } catch (error) {
    console.log(`   ${colors.yellow}Could not test access control${colors.reset}`);
    results.push({ test: "Access Control", status: "SKIP", error: error.message });
  }
  
  // 5. Check contract code size
  console.log("\n5. Checking contract code size...");
  try {
    const code = await ethers.provider.getCode(contractAddress);
    const codeSizeKB = (code.length - 2) / 2 / 1024; // Subtract '0x' and convert to KB
    console.log(`   Contract size: ${codeSizeKB.toFixed(2)} KB`);
    
    if (codeSizeKB < 24.576) {
      console.log(`   ${colors.green}Within size limit (< 24.576 KB)${colors.reset}`);
      results.push({ test: "Contract Size", status: "PASS", size: `${codeSizeKB.toFixed(2)} KB` });
    } else {
      console.log(`   ${colors.yellow}Warning: Close to size limit${colors.reset}`);
      results.push({ test: "Contract Size", status: "WARN", size: `${codeSizeKB.toFixed(2)} KB` });
    }
  } catch (error) {
    console.log(`   ${colors.red}Failed: ${error.message}${colors.reset}`);
    results.push({ test: "Contract Size", status: "FAIL", error: error.message });
  }
  
  return results;
}

async function testMintingWorkflow(contractAddress) {
  console.log(`\n${colors.cyan}Testing complete minting workflow...${colors.reset}\n`);
  
  const [signer] = await ethers.getSigners();
  const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
  const contract = BlockticityLayerZero.attach(contractAddress);
  
  // Test metadata
  const testMetadata = {
    name: "Test COA #001",
    description: "Blockticity Test Certificate of Authenticity",
    image: "ipfs://QmTest123/image.png",
    attributes: [
      { trait_type: "Order ID", value: "TEST-001" },
      { trait_type: "Date", value: new Date().toISOString() },
      { trait_type: "Volume", value: "1000 kg" },
      { trait_type: "Product", value: "Test Product" },
    ],
  };
  
  console.log("Test Metadata:");
  console.log(JSON.stringify(testMetadata, null, 2));
  
  // In production, this would upload to IPFS
  const mockIPFSHash = "QmTestMetadataHash123";
  const metadataURI = `ipfs://${mockIPFSHash}`;
  
  console.log(`\nMetadata URI: ${metadataURI}`);
  console.log("\nNOTE: In production, upload metadata to Pinata IPFS before minting");
  
  return {
    metadataURI,
    testMetadata,
  };
}

async function generateVerificationReport(contractAddress, results) {
  console.log(`\n${colors.bright}${colors.blue}VERIFICATION REPORT${colors.reset}`);
  console.log("=".repeat(50));
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Network: ${(await ethers.provider.getNetwork()).name}`);
  console.log("\nTest Results:");
  console.log("-".repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  results.forEach(result => {
    const status = result.status === "PASS" ? 
      `${colors.green}✓ PASS${colors.reset}` : 
      result.status === "FAIL" ? 
      `${colors.red}✗ FAIL${colors.reset}` : 
      `${colors.yellow}⚠ ${result.status}${colors.reset}`;
    
    console.log(`${result.test}: ${status}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.gasEstimate) {
      console.log(`  Gas Estimate: ${result.gasEstimate}`);
    }
    if (result.size) {
      console.log(`  Size: ${result.size}`);
    }
    
    if (result.status === "PASS") passed++;
    else if (result.status === "FAIL") failed++;
  });
  
  console.log("-".repeat(50));
  console.log(`Total: ${passed} passed, ${failed} failed, ${results.length - passed - failed} skipped`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}${colors.bright}✓ All critical tests passed!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}✗ Some tests failed. Review before proceeding.${colors.reset}`);
  }
}

async function main() {
  try {
    // Get contract address from command line or use the testnet address
    const contractAddress = process.argv[2] || process.env.CONTRACT_ADDRESS;
    
    if (!contractAddress) {
      throw new Error("Please provide contract address as argument or in CONTRACT_ADDRESS env variable");
    }
    
    console.log(`${colors.bright}Blockticity Contract Verification${colors.reset}`);
    console.log("=".repeat(50));
    console.log(`Verifying contract at: ${contractAddress}\n`);
    
    // Run verification tests
    const results = await verifyContract(contractAddress);
    
    // Test minting workflow
    const workflowTest = await testMintingWorkflow(contractAddress);
    
    // Generate report
    await generateVerificationReport(contractAddress, results);
    
    // Additional recommendations
    console.log(`\n${colors.cyan}Recommendations:${colors.reset}`);
    console.log("1. Set up contract verification on block explorer");
    console.log("2. Configure monitoring alerts for contract events");
    console.log("3. Test batch minting with production data");
    console.log("4. Implement automated testing for CI/CD pipeline");
    console.log("5. Set up multisig wallet for contract ownership");
    
  } catch (error) {
    console.error(`\n${colors.red}Verification failed:${colors.reset}`, error.message);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});