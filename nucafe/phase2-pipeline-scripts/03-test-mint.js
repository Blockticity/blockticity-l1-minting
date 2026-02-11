#!/usr/bin/env node
/**
 * Script 03: Test mint BAG-001 only.
 * Upload SVG to S3, mint single token, verify on-chain.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initS3, uploadSVG } from '../lib/s3-uploader.js';
import { initMinter, buildNftMetadata, encodeTokenURI, mintSingle, readTokenURI, getBalance } from '../lib/minter.js';
import { initAssets, renderBagSVG } from '../lib/svg-renderer.js';
import { computeContentHash, deriveGVE } from '../lib/content-hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

async function main() {
  console.log('=== NUCAFE Phase 2 — Script 03: Test Mint (BAG-001) ===\n');

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/nucafe-phase2.config.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/manifest.json'), 'utf8'));
  const bag001 = manifest.entries[0];

  if (!bag001) {
    console.error('ERROR: No entries in output/manifest.json — run script 02 first.');
    process.exit(1);
  }

  // Check for mainnet private key
  let privateKey = process.env.MAINNET_PRIVATE_KEY;
  if (!privateKey) {
    // Try loading from parent .env.mainnet (same as server.cjs)
    const mainnetEnvPath = path.resolve(ROOT, '../../../blockticity-l1-minting/.env.mainnet');
    if (fs.existsSync(mainnetEnvPath)) {
      const envContent = fs.readFileSync(mainnetEnvPath, 'utf8');
      const match = envContent.match(/MAINNET_PRIVATE_KEY=([^\s\n]+)/);
      if (match) privateKey = match[1];
    }
  }
  if (!privateKey) {
    console.error('ERROR: MAINNET_PRIVATE_KEY not found. Set it in .env or ensure blockticity-l1-minting/.env.mainnet exists.');
    process.exit(1);
  }

  // Init services
  initS3(config.s3);
  initMinter(config.chain.rpcUrl, privateKey, config.chain.contract);

  const balance = await getBalance();
  console.log(`Wallet balance: ${balance} BTIC`);

  // 1. Upload BAG-001 SVG to S3
  console.log(`\n--- Step 1: Upload BAG-001 SVG to S3 ---`);
  const svgContent = fs.readFileSync(path.join(ROOT, 'output/svg', bag001.svgFile), 'utf8');
  const s3Result = await uploadSVG(svgContent, bag001.gveCode, bag001.contentHash);
  console.log(`  S3 URL: ${s3Result.url}`);
  console.log(`  Size: ${s3Result.size} bytes`);

  // 2. Build NFT metadata + tokenURI
  console.log(`\n--- Step 2: Build NFT metadata ---`);
  const publicJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/publicJson', bag001.publicJsonFile), 'utf8'));
  const nftMetadata = buildNftMetadata(publicJson, bag001.contentHash, bag001.gveCode, s3Result.url, config);
  const tokenURI = encodeTokenURI(nftMetadata);
  console.log(`  TokenURI length: ${tokenURI.length} bytes`);

  // 3. Mint
  console.log(`\n--- Step 3: Mint BAG-001 ---`);
  console.log(`  Minting to: ${config.mintTo}`);
  const mintResult = await mintSingle(config.mintTo, tokenURI);
  console.log(`  Token ID: #${mintResult.tokenId}`);
  console.log(`  Tx Hash: ${mintResult.txHash}`);
  console.log(`  Gas Used: ${mintResult.gasUsed}`);

  // 4. Verify on-chain
  console.log(`\n--- Step 4: Verify on-chain ---`);
  const onChainURI = await readTokenURI(mintResult.tokenId);
  const base64 = onChainURI.slice('data:application/json;base64,'.length);
  const onChainMeta = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  const onChainHash = onChainMeta.blockticity?.verification?.contentHash ||
    onChainMeta.attributes?.find(a => a.trait_type === 'Content Hash')?.value;

  if (onChainHash === bag001.contentHash) {
    console.log(`  Content hash verified: ${onChainHash} ✓`);
  } else {
    console.error(`  Content hash MISMATCH: expected ${bag001.contentHash}, got ${onChainHash}`);
  }

  // 5. Re-render SVG with token ID and re-upload
  console.log(`\n--- Step 5: Re-render with token ID and re-upload ---`);
  const resolvePath = (p) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(ROOT, p);
  initAssets(resolvePath(config.assets.nucafeLogo), resolvePath(config.assets.blockticitySeal), resolvePath(config.assets.nucafeProductImage), resolvePath(config.assets.mapImage), resolvePath(config.assets.qrLogo));

  const renderData = {
    contentHash: bag001.contentHash,
    gveCode: bag001.gveCode,
    tokenId: mintResult.tokenId,
    certificateTitle: config.certificateTitle,
    productName: config.productName,
    productDescription: config.productDescription,
    issuerName: config.issuer.name,
    issuerAddress: config.issuer.address,
    primaryLabel: 'Bag Serial',
    primaryValue: bag001.identifier,
    productFields: publicJson.fields,
    latitude: config.coordinates.latitude,
    longitude: config.coordinates.longitude,
    qrDataUrl: null
  };
  const updatedSvg = await renderBagSVG(renderData);
  const reuploadResult = await uploadSVG(updatedSvg, bag001.gveCode, bag001.contentHash);
  console.log(`  Re-uploaded with token ID: ${reuploadResult.url}`);

  // Save test mint result
  const testResult = {
    bag: bag001.identifier,
    tokenId: mintResult.tokenId,
    txHash: mintResult.txHash,
    gasUsed: mintResult.gasUsed,
    s3Url: reuploadResult.url,
    contentHash: bag001.contentHash,
    verified: onChainHash === bag001.contentHash,
    mintedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(ROOT, 'output/test-mint-result.json'), JSON.stringify(testResult, null, 2));

  console.log(`\n=== Test mint OK — proceed to batch with script 04 ===`);
  console.log(`Token #${mintResult.tokenId} | Tx: ${mintResult.txHash}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
