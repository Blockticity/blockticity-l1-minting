#!/usr/bin/env node
/**
 * Script 05: Generate QA gallery HTML with Phase 1 cross-reference.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeFarmAttestationHash } from '../lib/farm-attestation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function main() {
  console.log('=== NUCAFE Phase 2 — Script 05: QA Gallery ===\n');

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/nucafe-phase2.config.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/manifest.json'), 'utf8'));
  const farmAttestation = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/farm-attestation.json'), 'utf8'));

  // Load mint log if available
  const mintLogPath = path.join(ROOT, 'output/mint-log.json');
  let mintLog = null;
  if (fs.existsSync(mintLogPath)) {
    mintLog = JSON.parse(fs.readFileSync(mintLogPath, 'utf8'));
  }

  // Re-verify attestation hash
  const recomputed = computeFarmAttestationHash(farmAttestation.contentHashes);
  const attestationVerified = recomputed === farmAttestation.farmAttestationHash;

  // Check that all bags have identical sourceAttestation
  let attestationConsistent = true;
  for (const entry of manifest.entries) {
    const pjPath = path.join(ROOT, 'output/publicJson', entry.publicJsonFile);
    if (fs.existsSync(pjPath)) {
      const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
      if (pj.sourceAttestation?.farmAttestationHash !== farmAttestation.farmAttestationHash) {
        attestationConsistent = false;
        break;
      }
    }
  }

  // Check for farm thumbnails
  const thumbnailDir = path.resolve(ROOT, '../coa-thumbnails');
  const hasThumbnails = fs.existsSync(thumbnailDir);

  // Build lot summary
  const lotManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/lot-manifest.json'), 'utf8'));
  const lotSummary = lotManifest.lots.map(l =>
    `<tr><td>${l.lotNumber}</td><td>BAG-${String(l.bagStart).padStart(3,'0')} – BAG-${String(l.bagEnd).padStart(3,'0')}</td><td>${l.count}</td></tr>`
  ).join('\n');

  // Build bag cards
  const bagCards = manifest.entries.map(entry => {
    const mintInfo = mintLog?.bags?.find(b => b.identifier === entry.identifier);
    const tokenId = mintInfo?.tokenId;
    const svgPath = `../svg/${entry.svgFile}`;

    return `
    <div class="bag-card">
      <div class="bag-thumb">
        <img src="${svgPath}" alt="${entry.identifier}" loading="lazy" />
      </div>
      <div class="bag-info">
        <strong>${entry.identifier}</strong>
        <span class="lot">Lot ${entry.lotNumber}</span>
        <span class="gve">${entry.gveCode}</span>
        ${tokenId ? `<a href="https://app.blockticity.ai/${tokenId}" target="_blank" class="token">#${tokenId}</a>` : '<span class="pending">PENDING</span>'}
      </div>
    </div>`;
  }).join('\n');

  // Build farm thumbnail grid
  let farmGrid = '';
  if (hasThumbnails) {
    const farmManifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, config.phase1.manifestPath), 'utf8'));
    farmGrid = farmManifest.entries.map(entry => {
      const thumbFile = `${entry.tokenId}.png`;
      const thumbPath = path.join(thumbnailDir, thumbFile);
      const exists = fs.existsSync(thumbPath);
      return `
      <a href="https://app.blockticity.ai/${entry.tokenId}" target="_blank" class="farm-thumb" title="Farm ${entry.farm} — Token #${entry.tokenId}">
        ${exists ? `<img src="../../coa-thumbnails/${thumbFile}" alt="Farm ${entry.farm}" loading="lazy" />` : `<div class="no-thumb">#${entry.tokenId}</div>`}
        <span>#${entry.tokenId}</span>
      </a>`;
    }).join('\n');
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NUCAFE Phase 2 — QA Gallery</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    h1 { color: #089CA2; margin-bottom: 5px; }
    h2 { color: #5A5A5A; margin: 25px 0 10px; border-bottom: 2px solid #5BD1D7; padding-bottom: 5px; }
    .subtitle { color: #666; margin-bottom: 20px; }

    .attestation-panel {
      background: white; border: 2px solid ${attestationVerified ? '#2ecc71' : '#e74c3c'}; border-radius: 8px;
      padding: 20px; margin: 20px 0;
    }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: white; }
    .badge.verified { background: #2ecc71; }
    .badge.failed { background: #e74c3c; }
    .hash { font-family: monospace; font-size: 11px; word-break: break-all; background: #f8f8f8; padding: 8px; border-radius: 4px; margin: 5px 0; }

    .farm-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; margin: 15px 0;
    }
    .farm-thumb {
      text-align: center; text-decoration: none; color: #089CA2; font-size: 10px;
    }
    .farm-thumb img { width: 100%; border-radius: 4px; border: 1px solid #ddd; }
    .farm-thumb .no-thumb { width: 100%; aspect-ratio: 1; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 11px; color: #999; }

    .lot-table { width: 100%; max-width: 500px; border-collapse: collapse; margin: 10px 0; }
    .lot-table th, .lot-table td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
    .lot-table th { background: #5BD1D7; color: white; }

    .stats { display: flex; gap: 20px; flex-wrap: wrap; margin: 15px 0; }
    .stat { background: white; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #5BD1D7; }
    .stat .num { font-size: 28px; font-weight: bold; color: #089CA2; }
    .stat .label { font-size: 12px; color: #666; }

    .bag-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin: 15px 0;
    }
    .bag-card {
      background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;
      transition: transform 0.2s;
    }
    .bag-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .bag-thumb img { width: 100%; display: block; }
    .bag-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
    .bag-info strong { font-size: 14px; }
    .bag-info .lot { font-size: 11px; color: #666; }
    .bag-info .gve { font-family: monospace; font-size: 10px; color: #089CA2; }
    .bag-info .token { font-size: 11px; color: #5BD1D7; text-decoration: none; font-weight: bold; }
    .bag-info .pending { font-size: 11px; color: #999; }

    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <h1>NUCAFE Phase 2 — QA Gallery</h1>
  <p class="subtitle">${config.project} | ${manifest.totalBags} Bag COAs | Generated ${manifest.generatedAt}</p>

  <div class="stats">
    <div class="stat"><div class="num">${manifest.totalBags}</div><div class="label">Total Bags</div></div>
    <div class="stat"><div class="num">${farmAttestation.totalFarms}</div><div class="label">Source Farms</div></div>
    <div class="stat"><div class="num">${lotManifest.lots.length}</div><div class="label">Lots</div></div>
    <div class="stat"><div class="num">${mintLog ? mintLog.bags.filter(b => b.tokenId).length : 0}</div><div class="label">Minted</div></div>
  </div>

  <h2>Phase 1 Farm Attestation Cross-Reference</h2>
  <div class="attestation-panel">
    <span class="badge ${attestationVerified ? 'verified' : 'failed'}">${attestationVerified ? 'VERIFIED' : 'FAILED'}</span>
    <span class="badge ${attestationConsistent ? 'verified' : 'failed'}">${attestationConsistent ? 'ALL 350 CONSISTENT' : 'INCONSISTENCY DETECTED'}</span>
    <p style="margin-top: 10px; font-size: 13px;">
      Farm Attestation Hash (SHA-256 of ${farmAttestation.totalFarms} sorted content hashes):
    </p>
    <div class="hash">${farmAttestation.farmAttestationHash}</div>
    <p style="font-size: 12px; color: #666; margin-top: 5px;">
      Token range: #${farmAttestation.farmTokenIds[0]} – #${farmAttestation.farmTokenIds[farmAttestation.farmTokenIds.length - 1]}
    </p>
    ${farmGrid ? `<h3 style="margin-top: 15px; font-size: 13px; color: #5A5A5A;">Farm COA Thumbnails (${farmAttestation.totalFarms})</h3><div class="farm-grid">${farmGrid}</div>` : ''}
  </div>

  <h2>Lot Distribution</h2>
  <table class="lot-table">
    <tr><th>Lot Number</th><th>Bag Range</th><th>Count</th></tr>
    ${lotSummary}
  </table>

  <h2>All ${manifest.totalBags} Bag COAs</h2>
  <div class="bag-grid">
    ${bagCards}
  </div>

  <div class="footer">
    Generated by NUCAFE Phase 2 Pipeline | ${new Date().toISOString()} | Blockticity L1 Chain ${config.chain.chainId}
  </div>
</body>
</html>`;

  const outDir = path.join(ROOT, 'output/qa-gallery');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  console.log(`QA Gallery generated: output/qa-gallery/index.html`);
  console.log(`Farm attestation: ${attestationVerified ? 'VERIFIED ✓' : 'FAILED ✗'}`);
  console.log(`Attestation consistency: ${attestationConsistent ? 'ALL 350 CONSISTENT ✓' : 'INCONSISTENCY DETECTED ✗'}`);
  console.log(`\n=== Script 05 complete ===`);
}

main();
