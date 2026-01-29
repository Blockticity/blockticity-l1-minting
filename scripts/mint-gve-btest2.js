const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Mint GVE certificates to BTEST2
 * Reads publicJson from GVE pipeline output and mints as NFTs
 */
async function main() {
  console.log('='.repeat(60));
  console.log('GVE Certificate Minting to BTEST2');
  console.log('='.repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log(`\nMinting wallet: ${deployer.address}`);

  // Contract setup
  const contractAddress = '0x72458e7a49dA8Ff516810c888c3c0afA1ab7CF55';
  const abi = [
    'function mintURI(address to, string memory uri) public',
    'function batchMintURI(address[] calldata recipients, string[] calldata uris) external',
    'function currentTokenId() external view returns (uint256)',
    'event COAMinted(address indexed to, uint256 indexed tokenId, string uri)'
  ];

  const contract = new ethers.Contract(contractAddress, abi, deployer);

  // Read manifest
  const manifestPath = path.join(
    __dirname,
    '../wacker-gve/pipeline/output/wacker-btest2/preview/manifest.json'
  );

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\nLoaded manifest with ${manifest.total} certificates`);

  // Read publicJson files and prepare for minting
  const publicJsonDir = path.join(
    __dirname,
    '../wacker-gve/pipeline/output/wacker-btest2/preview/publicJson'
  );

  const recipients = [];
  const uris = [];

  console.log('\nPreparing certificates for minting:');

  for (const cert of manifest.certificates) {
    const publicJsonPath = path.join(publicJsonDir, `${cert.tokenId}.json`);

    if (!fs.existsSync(publicJsonPath)) {
      console.warn(`  ⚠ Missing publicJson for token ${cert.tokenId}`);
      continue;
    }

    const publicJson = JSON.parse(fs.readFileSync(publicJsonPath, 'utf8'));

    // Create metadata for NFT (ERC721 standard format)
    // Simplified metadata without embedded publicJson to reduce gas
    const nftMetadata = {
      name: `Wacker COA #${cert.tokenId}`,
      description: `Certificate of Authenticity for Wacker Polysilicon - GVE: ${cert.gve}`,
      image: `https://app.blockticity.io/coa/svg/${cert.tokenId}.svg`,
      external_url: `https://app.blockticity.io/coa/${cert.tokenId}`,
      attributes: [
        { trait_type: "GVE Code", value: cert.gve },
        { trait_type: "Content Hash", value: cert.contentHash },
        { trait_type: "Network", value: "BTEST2" },
        { trait_type: "Issuer", value: "Wacker Polysilicon" },
        { trait_type: "Standard", value: "ASTM D8558" }
      ]
    };

    // Encode as data URI for testing (production would use IPFS)
    const metadataJson = JSON.stringify(nftMetadata);
    const base64Metadata = Buffer.from(metadataJson).toString('base64');
    const tokenUri = `data:application/json;base64,${base64Metadata}`;

    recipients.push(deployer.address);
    uris.push(tokenUri);

    console.log(`  ✓ ${cert.tokenId} - ${cert.gve}`);
  }

  console.log(`\n${recipients.length} certificates ready for minting`);

  // Check current token ID
  const tokenIdBefore = await contract.currentTokenId();
  console.log(`Current contract token ID: ${tokenIdBefore}`);

  // Batch mint in smaller batches (3 at a time to stay under 8M gas limit)
  const BATCH_SIZE = 3;
  const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);
  let totalGasUsed = 0n;

  console.log(`\nMinting in ${totalBatches} batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batchRecipients = recipients.slice(i, i + BATCH_SIZE);
    const batchUris = uris.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batchRecipients.length} certificates)...`);

    const tx = await contract.batchMintURI(batchRecipients, batchUris, {
      gasLimit: 6000000
    });
    console.log(`  TX: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`  Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`);
    totalGasUsed += receipt.gasUsed;
  }

  const tokenIdAfter = await contract.currentTokenId();
  const gasUsed = totalGasUsed;

  console.log('\n' + '='.repeat(60));
  console.log('MINTING COMPLETE!');
  console.log('='.repeat(60));
  console.log(`Certificates minted: ${recipients.length}`);
  console.log(`Contract token IDs: ${Number(tokenIdBefore) + 1} to ${tokenIdAfter}`);
  console.log(`Total gas used: ${gasUsed.toString()}`);
  console.log(`Gas per certificate: ${(Number(gasUsed) / recipients.length).toFixed(0)}`);

  // Summary table
  console.log('\nMinted Certificates:');
  console.log('-'.repeat(60));
  manifest.certificates.forEach((cert, i) => {
    const contractTokenId = Number(tokenIdBefore) + i + 1;
    console.log(`  GVE ${cert.gve} → Contract Token #${contractTokenId}`);
  });

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    certificateCount: recipients.length,
    firstTokenId: Number(tokenIdBefore) + 1,
    lastTokenId: Number(tokenIdAfter)
  };
}

main()
  .then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
