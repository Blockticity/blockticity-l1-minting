const { ethers } = require('hardhat');

async function main() {
  console.log('='.repeat(50));
  console.log('BTEST2 Test Mint');
  console.log('='.repeat(50));

  const [deployer] = await ethers.getSigners();
  console.log(`\nMinting wallet: ${deployer.address}`);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} BTEST2`);

  // Connect to deployed contract
  const contractAddress = '0x72458e7a49dA8Ff516810c888c3c0afA1ab7CF55';
  const abi = [
    'function mintURI(address to, string memory uri) public',
    'function currentTokenId() external view returns (uint256)',
    'function name() external view returns (string)',
    'function symbol() external view returns (string)',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'function tokenURI(uint256 tokenId) external view returns (string)'
  ];

  const contract = new ethers.Contract(contractAddress, abi, deployer);

  // Verify contract
  const name = await contract.name();
  const symbol = await contract.symbol();
  console.log(`\nContract: ${contractAddress}`);
  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);

  // Check current token ID before mint
  const tokenIdBefore = await contract.currentTokenId();
  console.log(`\nCurrent Token ID: ${tokenIdBefore}`);

  // Create test metadata
  const testMetadata = {
    name: "BTEST2 Genesis COA #1",
    description: "First Certificate of Authenticity minted on BTEST2 - Blockticity Sovereign L1 Testnet",
    image: "https://app.blockticity.io/assets/blockticity-coa-placeholder.png",
    attributes: [
      { trait_type: "Network", value: "BTEST2" },
      { trait_type: "Chain ID", value: "54928" },
      { trait_type: "Type", value: "Genesis Test" },
      { trait_type: "Minted", value: new Date().toISOString() }
    ],
    properties: {
      issuer: "Blockticity",
      standard: "ASTM D8558",
      network: "BTEST2 Sovereign L1",
      chainId: 54928
    }
  };

  // For this test, we'll use a data URI with the metadata
  // In production, this would be uploaded to IPFS first
  const metadataJson = JSON.stringify(testMetadata);
  const base64Metadata = Buffer.from(metadataJson).toString('base64');
  const tokenUri = `data:application/json;base64,${base64Metadata}`;

  console.log('\nMinting test COA...');
  console.log(`Recipient: ${deployer.address}`);

  // Mint the token
  const tx = await contract.mintURI(deployer.address, tokenUri);
  console.log(`Transaction hash: ${tx.hash}`);

  // Wait for confirmation
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`Block number: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  // Get the new token ID
  const tokenIdAfter = await contract.currentTokenId();
  console.log(`\nNew Token ID: ${tokenIdAfter}`);

  // Verify the mint
  const owner = await contract.ownerOf(tokenIdAfter);
  const uri = await contract.tokenURI(tokenIdAfter);

  console.log('\n' + '='.repeat(50));
  console.log('MINT SUCCESSFUL!');
  console.log('='.repeat(50));
  console.log(`Token ID: ${tokenIdAfter}`);
  console.log(`Owner: ${owner}`);
  console.log(`URI length: ${uri.length} chars`);
  console.log(`\nMetadata preview:`);
  console.log(JSON.stringify(testMetadata, null, 2));
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});
