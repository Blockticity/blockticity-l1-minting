const { ethers } = require('hardhat');

async function main() {
  console.log('='.repeat(50));
  console.log('BTEST2 Batch Mint Test');
  console.log('='.repeat(50));

  const [deployer] = await ethers.getSigners();
  console.log(`\nMinting wallet: ${deployer.address}`);

  const contractAddress = '0x72458e7a49dA8Ff516810c888c3c0afA1ab7CF55';
  const abi = [
    'function batchMintURI(address[] calldata recipients, string[] calldata uris) external',
    'function currentTokenId() external view returns (uint256)',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'function tokenURI(uint256 tokenId) external view returns (string)',
    'event BatchMintCompleted(uint256 count, uint256 firstTokenId, uint256 lastTokenId)'
  ];

  const contract = new ethers.Contract(contractAddress, abi, deployer);

  const tokenIdBefore = await contract.currentTokenId();
  console.log(`Current Token ID: ${tokenIdBefore}`);

  // Create 5 test COAs
  const batchSize = 5;
  const recipients = [];
  const uris = [];

  console.log(`\nPreparing ${batchSize} COAs for batch mint...`);

  for (let i = 0; i < batchSize; i++) {
    const tokenId = Number(tokenIdBefore) + i + 1;

    const metadata = {
      name: `BTEST2 Batch Test COA #${tokenId}`,
      description: `Batch minting test certificate ${i + 1} of ${batchSize} on BTEST2`,
      image: "https://app.blockticity.io/assets/blockticity-coa-placeholder.png",
      attributes: [
        { trait_type: "Network", value: "BTEST2" },
        { trait_type: "Chain ID", value: "54928" },
        { trait_type: "Batch Index", value: String(i + 1) },
        { trait_type: "Type", value: "Batch Test" }
      ]
    };

    const metadataJson = JSON.stringify(metadata);
    const base64Metadata = Buffer.from(metadataJson).toString('base64');
    const tokenUri = `data:application/json;base64,${base64Metadata}`;

    recipients.push(deployer.address);
    uris.push(tokenUri);

    console.log(`  - COA ${i + 1}: Token ID ${tokenId}`);
  }

  console.log('\nExecuting batch mint...');
  const tx = await contract.batchMintURI(recipients, uris);
  console.log(`Transaction hash: ${tx.hash}`);

  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`Block number: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`Gas per COA: ${(Number(receipt.gasUsed) / batchSize).toFixed(0)}`);

  const tokenIdAfter = await contract.currentTokenId();

  console.log('\n' + '='.repeat(50));
  console.log('BATCH MINT SUCCESSFUL!');
  console.log('='.repeat(50));
  console.log(`COAs minted: ${batchSize}`);
  console.log(`Token IDs: ${Number(tokenIdBefore) + 1} to ${tokenIdAfter}`);
  console.log(`Total tokens now: ${tokenIdAfter}`);

  // Verify each token
  console.log('\nVerifying minted tokens:');
  for (let i = Number(tokenIdBefore) + 1; i <= Number(tokenIdAfter); i++) {
    const owner = await contract.ownerOf(i);
    console.log(`  Token #${i}: Owner ${owner.slice(0, 10)}...`);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});
