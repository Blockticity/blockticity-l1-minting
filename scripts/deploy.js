const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contract with account: ${deployer.address}`);

  const BlockticityLayerZero = await ethers.getContractFactory('BlockticityLayerZero');
  const contract = await BlockticityLayerZero.deploy(); // No constructor parameters for simple version

  console.log('Transaction submitted. Waiting for deployment...');
  await contract.waitForDeployment(); // <-- THIS is correct in ethers v6

  console.log(`Contract deployed to address: ${contract.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
