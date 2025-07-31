const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ANSI color codes for better visibility
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

async function validateDeploymentEnvironment() {
  console.log(`${colors.cyan}Running pre-deployment checks...${colors.reset}`);
  
  // Check network
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  
  // Validate we're on mainnet
  if (network.chainId === 75234n) {
    throw new Error(`${colors.red}ERROR: You're on testnet (Chain ID: 75234). Use --network blockticityMainnet for mainnet deployment${colors.reset}`);
  }
  
  // Check required environment variables
  const required = ["MAINNET_RPC_URL", "MAINNET_PRIVATE_KEY"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
  
  // Check minimum balance (adjust based on your chain's requirements)
  const minBalance = ethers.parseEther("0.1");
  if (balance < minBalance) {
    throw new Error(`Insufficient balance. Required: ${ethers.formatEther(minBalance)} ETH`);
  }
  
  return { deployer, network };
}

async function deployContract(deployer) {
  console.log(`\n${colors.cyan}Deploying BlockticityLayerZero contract...${colors.reset}`);
  
  // Get contract factory
  const BlockticityLayerZero = await ethers.getContractFactory("BlockticityLayerZero");
  
  // Estimate deployment gas
  const deploymentData = BlockticityLayerZero.getDeployTransaction().data;
  const estimatedGas = await ethers.provider.estimateGas({
    from: deployer.address,
    data: deploymentData,
  });
  
  const gasPrice = await ethers.provider.getFeeData();
  const estimatedCost = estimatedGas * gasPrice.gasPrice;
  
  console.log(`Estimated gas: ${estimatedGas.toString()}`);
  console.log(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice, "gwei")} gwei`);
  console.log(`Estimated deployment cost: ${ethers.formatEther(estimatedCost)} ETH`);
  
  // Deploy contract
  console.log(`\n${colors.yellow}Deploying contract...${colors.reset}`);
  const contract = await BlockticityLayerZero.deploy();
  
  console.log(`Transaction hash: ${contract.deploymentTransaction().hash}`);
  console.log("Waiting for deployment confirmation...");
  
  // Wait for deployment with timeout
  const deployedContract = await contract.waitForDeployment();
  const contractAddress = await deployedContract.getAddress();
  
  console.log(`${colors.green}Contract deployed successfully!${colors.reset}`);
  console.log(`Contract address: ${contractAddress}`);
  
  // Wait for additional confirmations
  console.log("Waiting for additional confirmations...");
  await contract.deploymentTransaction().wait(3);
  
  return { contract: deployedContract, address: contractAddress };
}

async function verifyDeployment(contract, contractAddress) {
  console.log(`\n${colors.cyan}Verifying deployment...${colors.reset}`);
  
  // Check contract state
  const name = await contract.name();
  const symbol = await contract.symbol();
  const owner = await contract.owner();
  const currentTokenId = await contract.currentTokenId();
  
  console.log(`Contract name: ${name}`);
  console.log(`Contract symbol: ${symbol}`);
  console.log(`Contract owner: ${owner}`);
  console.log(`Current token ID: ${currentTokenId}`);
  
  // Test mintURI function (dry run - not actually executing)
  try {
    const testAddress = "0x0000000000000000000000000000000000000001";
    const testURI = "ipfs://test";
    await contract.mintURI.estimateGas(testAddress, testURI);
    console.log(`${colors.green}✓ mintURI function is callable${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}✗ mintURI function check failed: ${error.message}${colors.reset}`);
  }
  
  return true;
}

async function saveDeploymentInfo(contractAddress, network, deployer) {
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: network.chainId.toString(),
    },
    contract: {
      address: contractAddress,
      name: "BlockticityLayerZero",
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      abi: require("../artifacts/contracts/BlockticityLayerZero.sol/BlockticityLayerZero.json").abi,
    },
    configuration: {
      tokenName: "Blockticity COA",
      tokenSymbol: "BTIC",
      standard: "ERC-721",
    },
  };
  
  const fileName = `deployment-mainnet-${Date.now()}.json`;
  const filePath = path.join(__dirname, "..", "deployments", fileName);
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${filePath}`);
  
  return deploymentInfo;
}

async function main() {
  try {
    console.log(`${colors.bright}${colors.blue}Blockticity LayerZero Mainnet Deployment${colors.reset}`);
    console.log("==========================================\n");
    
    // Pre-deployment validation
    const { deployer, network } = await validateDeploymentEnvironment();
    
    // Confirmation prompt
    console.log(`\n${colors.yellow}⚠️  WARNING: You are about to deploy to MAINNET${colors.reset}`);
    console.log("This action cannot be undone and will cost real funds.");
    console.log("\nPress Ctrl+C to cancel, or wait 10 seconds to continue...");
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Deploy contract
    const { contract, address } = await deployContract(deployer);
    
    // Verify deployment
    await verifyDeployment(contract, address);
    
    // Save deployment information
    const deploymentInfo = await saveDeploymentInfo(address, network, deployer);
    
    // Final summary
    console.log(`\n${colors.bright}${colors.green}DEPLOYMENT SUCCESSFUL!${colors.reset}`);
    console.log("=====================================");
    console.log(`Contract Address: ${address}`);
    console.log(`Owner Address: ${deployer.address}`);
    console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log("\nNEXT STEPS:");
    console.log("1. Verify contract on block explorer");
    console.log("2. Update .env with new contract address");
    console.log("3. Test minting functionality");
    console.log("4. Set up monitoring and alerts");
    console.log("5. Configure batch minting scripts");
    
  } catch (error) {
    console.error(`\n${colors.red}Deployment failed:${colors.reset}`, error.message);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});