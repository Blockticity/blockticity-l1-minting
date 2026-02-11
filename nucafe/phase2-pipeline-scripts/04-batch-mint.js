#!/usr/bin/env node
/**
 * Script 04: Batch mint remaining 349 bags (or all 350 if no test mint).
 * Batches of 10, with checkpoint-based resume on failure.
 * Post-mint: re-renders all SVGs with token IDs and re-uploads to S3.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initS3, uploadSVG, uploadBatch } from '../lib/s3-uploader.js';
import { initMinter, buildNftMetadata, encodeTokenURI, mintSingle, getBalance } from '../lib/minter.js';
import { initAssets, renderBagSVG } from '../lib/svg-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const BATCH_SIZE = 10;
const S3_CONCURRENCY = 5;

async function main() {
  console.log('=== NUCAFE Phase 2 — Script 04: Batch Mint ===\n');

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/nucafe-phase2.config.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/manifest.json'), 'utf8'));

  // Load checkpoint if exists (for resume)
  const checkpointPath = path.join(ROOT, 'output/mint-checkpoint.json');
  let checkpoint = { mintedBags: {}, lastBatchIndex: 0 };
  if (fs.existsSync(checkpointPath)) {
    checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    console.log(`Resuming from checkpoint: ${Object.keys(checkpoint.mintedBags).length} bags already minted`);
  }

  // Check for test mint result (BAG-001)
  const testMintPath = path.join(ROOT, 'output/test-mint-result.json');
  if (fs.existsSync(testMintPath)) {
    const testResult = JSON.parse(fs.readFileSync(testMintPath, 'utf8'));
    if (testResult.tokenId && !checkpoint.mintedBags['BAG-001']) {
      checkpoint.mintedBags['BAG-001'] = {
        tokenId: testResult.tokenId,
        txHash: testResult.txHash,
        s3Url: testResult.s3Url
      };
      console.log(`Including test mint: BAG-001 → Token #${testResult.tokenId}`);
    }
  }

  // Determine which bags still need minting
  const remaining = manifest.entries.filter(e => !checkpoint.mintedBags[e.identifier]);
  console.log(`Bags to mint: ${remaining.length} of ${manifest.entries.length}`);

  if (remaining.length === 0) {
    console.log('All bags already minted! Skipping to post-mint re-render.');
  }

  // Init services
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
  console.log(`Wallet balance: ${balance} BTIC\n`);

  // Process in batches
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

    console.log(`--- Batch ${batchNum}/${totalBatches} (${batch.length} bags) ---`);

    // 1. Upload SVGs to S3
    const uploadItems = batch.map(entry => ({
      svg: fs.readFileSync(path.join(ROOT, 'output/svg', entry.svgFile), 'utf8'),
      gveCode: entry.gveCode,
      contentHash: entry.contentHash
    }));

    const s3Results = await uploadBatch(uploadItems, S3_CONCURRENCY);
    console.log(`  S3 uploads: ${s3Results.length} ✓`);

    // 2. Build tokenURIs
    const recipients = [];
    const tokenURIs = [];
    for (let j = 0; j < batch.length; j++) {
      const entry = batch[j];
      const publicJson = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'output/publicJson', entry.publicJsonFile), 'utf8')
      );
      const nftMetadata = buildNftMetadata(publicJson, entry.contentHash, entry.gveCode, s3Results[j].url, config);
      recipients.push(config.mintTo);
      tokenURIs.push(encodeTokenURI(nftMetadata));
    }

    // 3. Mint individually (batchMintURI fails with large tokenURIs)
    let totalGas = 0n;
    for (let j = 0; j < batch.length; j++) {
      const entry = batch[j];
      let result = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          result = await mintSingle(recipients[j], tokenURIs[j]);
          break;
        } catch (err) {
          if (attempt < 3 && err.message.includes('timeout')) {
            console.warn(`    ${entry.identifier} timeout (attempt ${attempt}/3), retrying...`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            console.error(`  Mint FAILED on ${entry.identifier}: ${err.message}`);
            console.error('  Checkpoint already saved. Resume by re-running script 04.');
            process.exit(1);
          }
        }
      }
      totalGas += BigInt(result.gasUsed);
      console.log(`    ${entry.identifier} → #${result.tokenId} (gas: ${result.gasUsed})`);

      checkpoint.mintedBags[entry.identifier] = {
        tokenId: result.tokenId,
        txHash: result.txHash,
        s3Url: s3Results[j].url
      };
      // Save checkpoint after EACH mint for reliable resume
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    }
    checkpoint.lastBatchIndex = i + batch.length;

    console.log(`  Batch gas: ${totalGas} | Total minted: ${Object.keys(checkpoint.mintedBags).length}\n`);
  }

  // Post-mint: re-render all SVGs with token IDs and re-upload
  console.log('=== Post-mint: Re-rendering SVGs with token IDs ===\n');

  const resolvePath = (p) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(ROOT, p);
  initAssets(resolvePath(config.assets.nucafeLogo), resolvePath(config.assets.blockticitySeal), resolvePath(config.assets.nucafeProductImage), resolvePath(config.assets.mapImage), resolvePath(config.assets.qrLogo));

  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i];
    const minted = checkpoint.mintedBags[entry.identifier];
    if (!minted?.tokenId) continue;

    const publicJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'output/publicJson', entry.publicJsonFile), 'utf8')
    );

    const renderData = {
      contentHash: entry.contentHash,
      gveCode: entry.gveCode,
      tokenId: minted.tokenId,
      certificateTitle: config.certificateTitle,
      productName: config.productName,
      productDescription: config.productDescription,
      issuerName: config.issuer.name,
      issuerAddress: config.issuer.address,
      primaryLabel: 'Bag Serial',
      primaryValue: entry.identifier,
      productFields: publicJson.fields,
      latitude: config.coordinates.latitude,
      longitude: config.coordinates.longitude,
      qrDataUrl: null
    };

    const updatedSvg = await renderBagSVG(renderData);
    fs.writeFileSync(path.join(ROOT, 'output/svg', entry.svgFile), updatedSvg);

    if ((i + 1) % 50 === 0 || i === manifest.entries.length - 1) {
      console.log(`  Re-rendered: ${i + 1}/${manifest.entries.length}`);
    }
  }

  // Re-upload all to S3
  console.log('\nRe-uploading updated SVGs to S3...');
  for (let i = 0; i < manifest.entries.length; i += S3_CONCURRENCY) {
    const batch = manifest.entries.slice(i, i + S3_CONCURRENCY);
    const items = batch.map(entry => ({
      svg: fs.readFileSync(path.join(ROOT, 'output/svg', entry.svgFile), 'utf8'),
      gveCode: entry.gveCode,
      contentHash: entry.contentHash
    }));
    await uploadBatch(items, S3_CONCURRENCY);

    if ((i + S3_CONCURRENCY) % 50 < S3_CONCURRENCY || i + S3_CONCURRENCY >= manifest.entries.length) {
      console.log(`  Uploaded: ${Math.min(i + S3_CONCURRENCY, manifest.entries.length)}/${manifest.entries.length}`);
    }
  }

  // Save final mint log
  const mintLog = {
    project: config.project,
    completedAt: new Date().toISOString(),
    totalMinted: Object.keys(checkpoint.mintedBags).length,
    bags: manifest.entries.map(e => ({
      identifier: e.identifier,
      serial: e.serial,
      lotNumber: e.lotNumber,
      contentHash: e.contentHash,
      gveCode: e.gveCode,
      tokenId: checkpoint.mintedBags[e.identifier]?.tokenId || null,
      txHash: checkpoint.mintedBags[e.identifier]?.txHash || null,
      s3Url: checkpoint.mintedBags[e.identifier]?.s3Url || null
    }))
  };
  fs.writeFileSync(path.join(ROOT, 'output/mint-log.json'), JSON.stringify(mintLog, null, 2));

  console.log(`\n=== Script 04 complete: ${Object.keys(checkpoint.mintedBags).length} bags minted ===`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
