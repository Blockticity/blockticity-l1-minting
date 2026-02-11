#!/usr/bin/env node
/**
 * Mint first 5 bags (BAG-001 through BAG-005) individually via mintURI.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initS3, uploadSVG } from '../lib/s3-uploader.js';
import { initMinter, buildNftMetadata, encodeTokenURI, mintSingle, readTokenURI, getBalance } from '../lib/minter.js';
import { initAssets, renderBagSVG } from '../lib/svg-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const COUNT = 5;

async function main() {
  console.log(`=== NUCAFE Phase 2 — Mint First ${COUNT} Bags ===\n`);

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/nucafe-phase2.config.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/manifest.json'), 'utf8'));
  const bags = manifest.entries.slice(0, COUNT);

  // Load private key
  let privateKey = process.env.MAINNET_PRIVATE_KEY;
  if (!privateKey) {
    const mainnetEnvPath = '/Users/guppynft/blockticity-l1-minting/.env.mainnet';
    if (fs.existsSync(mainnetEnvPath)) {
      const envContent = fs.readFileSync(mainnetEnvPath, 'utf8');
      const match = envContent.match(/MAINNET_PRIVATE_KEY=([^\s\n]+)/);
      if (match) privateKey = match[1];
    }
  }
  if (!privateKey) {
    console.error('ERROR: MAINNET_PRIVATE_KEY not found.');
    process.exit(1);
  }

  initS3(config.s3);
  initMinter(config.chain.rpcUrl, privateKey, config.chain.contract);

  const balance = await getBalance();
  console.log(`Wallet balance: ${balance} BTIC`);
  console.log(`Minting to: ${config.mintTo}\n`);

  const results = [];

  for (let i = 0; i < bags.length; i++) {
    const entry = bags[i];
    console.log(`--- ${entry.identifier} (${i + 1}/${COUNT}) ---`);

    // 1. Upload SVG to S3
    const svgContent = fs.readFileSync(path.join(ROOT, 'output/svg', entry.svgFile), 'utf8');
    const s3Result = await uploadSVG(svgContent, entry.gveCode, entry.contentHash);
    console.log(`  S3: ${s3Result.url}`);

    // 2. Build metadata + tokenURI
    const publicJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'output/publicJson', entry.publicJsonFile), 'utf8')
    );
    const nftMetadata = buildNftMetadata(publicJson, entry.contentHash, entry.gveCode, s3Result.url, config);
    const tokenURI = encodeTokenURI(nftMetadata);
    console.log(`  TokenURI: ${tokenURI.length} bytes`);

    // 3. Mint
    const mintResult = await mintSingle(config.mintTo, tokenURI);
    console.log(`  Token: #${mintResult.tokenId} | Gas: ${mintResult.gasUsed}`);
    console.log(`  Tx: ${mintResult.txHash}`);

    // 4. Verify on-chain
    const onChainURI = await readTokenURI(mintResult.tokenId);
    const base64 = onChainURI.slice('data:application/json;base64,'.length);
    const meta = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    const onChainHash = meta.blockticity?.verification?.contentHash ||
      meta.attributes?.find(a => a.trait_type === 'Content Hash')?.value;
    const verified = onChainHash === entry.contentHash;
    console.log(`  Verified: ${verified ? '✓' : '✗ MISMATCH'}\n`);

    results.push({
      identifier: entry.identifier,
      serial: entry.serial,
      lotNumber: entry.lotNumber,
      tokenId: mintResult.tokenId,
      txHash: mintResult.txHash,
      gasUsed: mintResult.gasUsed,
      s3Url: s3Result.url,
      contentHash: entry.contentHash,
      gveCode: entry.gveCode,
      verified
    });
  }

  // 5. Re-render SVGs with token IDs and re-upload
  console.log('--- Re-rendering with token IDs ---');
  const resolvePath = (p) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(ROOT, p);
  initAssets(resolvePath(config.assets.nucafeLogo), resolvePath(config.assets.blockticitySeal), resolvePath(config.assets.nucafeProductImage), resolvePath(config.assets.mapImage), resolvePath(config.assets.qrLogo));

  for (const r of results) {
    const entry = bags.find(b => b.identifier === r.identifier);
    const publicJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'output/publicJson', entry.publicJsonFile), 'utf8')
    );
    const renderData = {
      contentHash: r.contentHash,
      gveCode: r.gveCode,
      tokenId: r.tokenId,
      certificateTitle: config.certificateTitle,
      productName: config.productName,
      productDescription: config.productDescription,
      issuerName: config.issuer.name,
      issuerAddress: config.issuer.address,
      primaryLabel: 'Bag Serial',
      primaryValue: r.identifier,
      productFields: publicJson.fields,
      latitude: config.coordinates.latitude,
      longitude: config.coordinates.longitude,
      qrDataUrl: null
    };
    const updatedSvg = await renderBagSVG(renderData);
    fs.writeFileSync(path.join(ROOT, 'output/svg', entry.svgFile), updatedSvg);
    const reupload = await uploadSVG(updatedSvg, r.gveCode, r.contentHash);
    console.log(`  ${r.identifier} → #${r.tokenId} re-uploaded ✓`);
  }

  // 6. Save checkpoint
  const checkpointPath = path.join(ROOT, 'output/mint-checkpoint.json');
  const checkpoint = { mintedBags: {}, lastBatchIndex: COUNT };
  results.forEach(r => {
    checkpoint.mintedBags[r.identifier] = {
      tokenId: r.tokenId,
      txHash: r.txHash,
      s3Url: r.s3Url
    };
  });
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('MINT SUMMARY — First 5 Bags');
  console.log('='.repeat(60));
  results.forEach(r => {
    console.log(`  ${r.identifier} | Lot ${r.lotNumber} | #${r.tokenId} | ${r.gveCode} | ${r.verified ? '✓' : '✗'}`);
  });
  console.log(`\nView COAs:`);
  results.forEach(r => console.log(`  https://app.blockticity.ai/${r.tokenId}`));
  console.log('\nCheckpoint saved — script 04 will continue from BAG-006.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
