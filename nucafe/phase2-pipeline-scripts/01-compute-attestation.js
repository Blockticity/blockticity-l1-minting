#!/usr/bin/env node
/**
 * Script 01: Compute farm attestation hash from on-chain data.
 * Fetches all 42 tokenURIs, extracts contentHash from each,
 * then computes attestation hash (SHA-256 of sorted hashes joined).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import { computeFarmAttestationHash } from '../lib/farm-attestation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load config
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/nucafe-phase2.config.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, config.phase1.manifestPath), 'utf8'));

const RPC_URL = config.chain.rpcUrl;
const CONTRACT = config.chain.contract;

const ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)'
];

async function main() {
  console.log('=== NUCAFE Phase 2 — Script 01: Compute Farm Attestation ===\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT, ABI, provider);

  const farmTokenIds = manifest.entries.map(e => e.tokenId).sort((a, b) => a - b);
  console.log(`Fetching ${farmTokenIds.length} tokenURIs from chain ${config.chain.chainId}...`);
  console.log(`Token range: #${farmTokenIds[0]} – #${farmTokenIds[farmTokenIds.length - 1]}\n`);

  const contentHashes = [];
  const errors = [];

  for (let i = 0; i < farmTokenIds.length; i++) {
    const tokenId = farmTokenIds[i];
    try {
      const tokenURI = await contract.tokenURI(tokenId);

      // Decode base64 JSON from data URI
      let metadata;
      if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64 = tokenURI.slice('data:application/json;base64,'.length);
        metadata = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      } else {
        throw new Error(`Unexpected tokenURI format for token ${tokenId}`);
      }

      // Extract contentHash from blockticity.verification.contentHash or from attributes
      let contentHash = null;

      // Try blockticity embedded publicJson
      if (metadata.blockticity) {
        const pj = metadata.blockticity;
        if (pj.verification?.contentHash) {
          contentHash = pj.verification.contentHash;
        }
      }

      // Fallback: check attributes
      if (!contentHash && metadata.attributes) {
        const attr = metadata.attributes.find(a => a.trait_type === 'Content Hash');
        if (attr) contentHash = attr.value;
      }

      if (!contentHash) {
        throw new Error(`No contentHash found in token ${tokenId} metadata`);
      }

      contentHashes.push(contentHash);
      const gve = 'GVE-' + contentHash.slice(2, 10);
      process.stdout.write(`  #${tokenId} ${gve} ✓\n`);

    } catch (err) {
      errors.push({ tokenId, error: err.message });
      console.error(`  #${tokenId} ✗ ${err.message}`);
    }
  }

  console.log(`\nFetched: ${contentHashes.length}/${farmTokenIds.length}`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} errors — cannot proceed.`);
    process.exit(1);
  }

  // Compute attestation hash
  const farmAttestationHash = computeFarmAttestationHash(contentHashes);
  console.log(`\nFarm Attestation Hash: ${farmAttestationHash}`);

  // Cross-check: recompute independently
  const recomputed = computeFarmAttestationHash(contentHashes);
  if (recomputed !== farmAttestationHash) {
    console.error('FATAL: Attestation hash not deterministic!');
    process.exit(1);
  }
  console.log('Determinism check: PASSED ✓');

  // Save output
  const output = {
    farmAttestationHash,
    farmTokenIds,
    contentHashes,
    computedAt: new Date().toISOString(),
    chainId: config.chain.chainId,
    contract: CONTRACT,
    totalFarms: farmTokenIds.length
  };

  const outPath = path.join(ROOT, 'data/farm-attestation.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved: ${outPath}`);
  console.log('\n=== Script 01 complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
