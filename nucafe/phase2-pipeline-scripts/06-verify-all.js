#!/usr/bin/env node
/**
 * Script 06: On-chain verification of all 350 minted tokens.
 * Fetches tokenURI for each, decodes, verifies contentHash + attestation.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import { computeFarmAttestationHash } from '../lib/farm-attestation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

async function main() {
  console.log('=== NUCAFE Phase 2 — Script 06: Verify All On-Chain ===\n');

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/nucafe-phase2.config.json'), 'utf8'));
  const mintLog = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/mint-log.json'), 'utf8'));
  const farmAttestation = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/farm-attestation.json'), 'utf8'));

  const provider = new ethers.JsonRpcProvider(config.chain.rpcUrl);
  const contract = new ethers.Contract(config.chain.contract, ABI, provider);

  const mintedBags = mintLog.bags.filter(b => b.tokenId);
  console.log(`Verifying ${mintedBags.length} minted tokens...\n`);

  let verified = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < mintedBags.length; i++) {
    const bag = mintedBags[i];
    try {
      // Fetch tokenURI
      const tokenURI = await contract.tokenURI(bag.tokenId);

      // Decode
      if (!tokenURI.startsWith('data:application/json;base64,')) {
        throw new Error('Unexpected tokenURI format');
      }
      const base64 = tokenURI.slice('data:application/json;base64,'.length);
      const metadata = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

      // Verify content hash
      const onChainHash = metadata.blockticity?.verification?.contentHash ||
        metadata.attributes?.find(a => a.trait_type === 'Content Hash')?.value;

      if (onChainHash !== bag.contentHash) {
        throw new Error(`Content hash mismatch: expected ${bag.contentHash}, got ${onChainHash}`);
      }

      // Verify attestation hash
      const onChainAttestation = metadata.blockticity?.sourceAttestation?.farmAttestationHash;
      if (onChainAttestation !== farmAttestation.farmAttestationHash) {
        throw new Error(`Attestation hash mismatch: expected ${farmAttestation.farmAttestationHash}, got ${onChainAttestation}`);
      }

      // Verify farm token IDs
      const onChainFarmIds = metadata.blockticity?.sourceAttestation?.farmTokenIds;
      if (onChainFarmIds) {
        const expected = farmAttestation.farmTokenIds.join(',');
        const actual = onChainFarmIds.join(',');
        if (expected !== actual) {
          throw new Error('Farm token IDs mismatch');
        }
      }

      verified++;
      if ((i + 1) % 50 === 0 || i === mintedBags.length - 1) {
        console.log(`  Verified: ${verified}/${mintedBags.length} (${bag.identifier} #${bag.tokenId} ✓)`);
      }

    } catch (err) {
      failed++;
      failures.push({ identifier: bag.identifier, tokenId: bag.tokenId, error: err.message });
      console.error(`  ${bag.identifier} #${bag.tokenId} ✗ ${err.message}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`VERIFICATION SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Total minted:   ${mintedBags.length}`);
  console.log(`Verified:       ${verified} ✓`);
  console.log(`Failed:         ${failed} ✗`);

  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach(f => console.log(`  ${f.identifier} #${f.tokenId}: ${f.error}`));
  }

  // Re-verify attestation hash independently
  const recomputed = computeFarmAttestationHash(farmAttestation.contentHashes);
  const attestationOk = recomputed === farmAttestation.farmAttestationHash;
  console.log(`\nFarm attestation hash recomputed: ${attestationOk ? 'MATCH ✓' : 'MISMATCH ✗'}`);

  // Save verification report
  const report = {
    verifiedAt: new Date().toISOString(),
    totalMinted: mintedBags.length,
    verified,
    failed,
    failures,
    farmAttestationVerified: attestationOk
  };
  fs.writeFileSync(path.join(ROOT, 'output/verification-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nReport saved: output/verification-report.json`);

  console.log(`\n=== Script 06 complete: ${verified}/${mintedBags.length} verified ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
