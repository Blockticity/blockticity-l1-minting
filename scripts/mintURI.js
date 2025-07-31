const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
  // Use environment variable for contract address - defaults to mainnet if not specified
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.MAINNET_CONTRACT || '0x7D1955F814f25Ec2065C01B9bFc0AcC29B3f2926';
  const [deployer] = await ethers.getSigners();
  const contract = await ethers.getContractAt('BlockticityLayerZero', contractAddress);

  console.log(`Minting Metadata NFT to address: ${deployer.address}`);

  const metadataURI = "https://aquamarine-adequate-rhinoceros-296.mypinata.cloud/ipfs/bafkreifb4777sxnm6gyoh3uswdmkdpuw4h5kuogapb2r7t3xfki7mfdpy4";
  
  const tx = await contract.mintURI(deployer.address, metadataURI);
  console.log('Transaction submitted. Waiting for confirmation...');
  await tx.wait();
  console.log('NFT minted successfully!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
