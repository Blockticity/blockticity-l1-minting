const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying BlockticityLayerZeroV2 to BTEST2`);
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} BTEST2`);

  const BlockticityLayerZeroV2 = await ethers.getContractFactory('contracts/BlockticityLayerZeroV2.sol:BlockticityLayerZeroV2');
  console.log('Deploying contract...');

  const contract = await BlockticityLayerZeroV2.deploy();
  console.log('Transaction submitted. Waiting for deployment...');

  await contract.waitForDeployment();

  console.log('');
  console.log('========================================');
  console.log('DEPLOYMENT SUCCESSFUL!');
  console.log('========================================');
  console.log(`Contract address: ${contract.target}`);
  console.log(`Network: BTEST2 (Chain ID: 54928)`);
  console.log(`Owner: ${deployer.address}`);
  console.log('');
  console.log('Add to .env:');
  console.log(`BTEST2_CONTRACT=${contract.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
