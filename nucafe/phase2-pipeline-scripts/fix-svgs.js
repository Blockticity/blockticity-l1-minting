#!/usr/bin/env node
/**
 * Fix 350 Phase 2 bag COA SVGs:
 * 1. Remove "Lot No. / ICO No." row (rect + 2 texts)
 * 2. Shift "Farm Attestation" row up 25px to close the gap
 * 3. Fix Shipment Ref: "SC 2526.040" → "SC 2526.004"
 *
 * Fetches from S3, patches, re-uploads to same path, saves local copy.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const NUCAFE = path.resolve(ROOT, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET = 'blockticity-coa-uploads';

const THUMB_DIR = path.join(NUCAFE, 'phase2-coa-thumbnails');

function patchSvg(svg) {
  let patched = svg;

  // 1. Fix Shipment Ref value
  patched = patched.replace(/SC 2526\.040/g, 'SC 2526.004');

  // 2. Remove "Lot No. / ICO No." row:
  //    - rect at y="155" height="25"
  //    - text label at y="172" containing "Lot No"
  //    - text value at y="172" with the lot number
  patched = patched.replace(
    /\s*<rect x="0" y="155" width="380" height="25" fill="#FFFFFF" stroke="#E8E8E8" stroke-width="0\.5"\/>\s*\n\s*<text x="10" y="172"[^>]*>Lot No\. \/ ICO No\.<\/text>\s*\n\s*<text x="200" y="172"[^>]*>[^<]*<\/text>/,
    ''
  );

  // 3. Shift "Farm Attestation" row up 25px (y=180→155 for rect, y=197→172 for texts)
  patched = patched.replace(
    /<rect x="0" y="180" width="380" height="25"/,
    '<rect x="0" y="155" width="380" height="25"'
  );
  patched = patched.replace(
    /<text x="10" y="197" font-family="Arial" font-size="9" fill="#5A5A5A">Farm Attestation<\/text>/,
    '<text x="10" y="172" font-family="Arial" font-size="9" fill="#5A5A5A">Farm Attestation</text>'
  );
  patched = patched.replace(
    /<text x="200" y="197" font-family="Arial" font-size="9" font-weight="bold" fill="#5A5A5A">(0x[a-f0-9]+\.{3})<\/text>/,
    '<text x="200" y="172" font-family="Arial" font-size="9" font-weight="bold" fill="#5A5A5A">$1</text>'
  );

  return patched;
}

async function fetchFromS3(key) {
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return resp.Body.transformToString('utf-8');
}

async function uploadToS3(key, svg) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: svg,
    ContentType: 'image/svg+xml',
    CacheControl: 'no-cache, no-store, must-revalidate'
  }));
}

async function main() {
  console.log('=== Fix 350 Phase 2 SVGs ===\n');

  const mintLog = JSON.parse(fs.readFileSync(path.join(NUCAFE, 'phase2-mint-log.json'), 'utf8'));
  const bags = mintLog.bags;
  console.log(`Bags to fix: ${bags.length}\n`);

  let fixed = 0;
  let uploaded = 0;
  let thumbs = 0;
  let errors = [];

  for (let i = 0; i < bags.length; i++) {
    const bag = bags[i];
    const { identifier, tokenId, s3Url } = bag;

    try {
      // Parse S3 key from URL
      const urlObj = new URL(s3Url);
      const s3Key = urlObj.pathname.slice(1); // remove leading /

      // Try local SVG first, fall back to S3
      const localPath = path.join(ROOT, 'output/svg', `${identifier}.svg`);
      let svg;
      if (fs.existsSync(localPath)) {
        svg = fs.readFileSync(localPath, 'utf8');
      } else {
        svg = await fetchFromS3(s3Key);
      }

      // Patch
      const patched = patchSvg(svg);

      // Verify changes were made
      if (patched === svg) {
        console.warn(`  WARNING: No changes made to ${identifier}`);
      }

      // Save local copy
      fs.writeFileSync(localPath, patched);
      fixed++;

      // Upload to S3
      await uploadToS3(s3Key, patched);
      uploaded++;

      // Re-extract thumbnail
      try {
        const thumbPng = await sharp(Buffer.from(patched))
          .resize(120, 80, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer();
        fs.writeFileSync(path.join(THUMB_DIR, `${tokenId}.png`), thumbPng);
        thumbs++;
      } catch (err) {
        try {
          const thumbPng = await sharp(Buffer.from(patched), { density: 72 })
            .resize(120, 80, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .png()
            .toBuffer();
          fs.writeFileSync(path.join(THUMB_DIR, `${tokenId}.png`), thumbPng);
          thumbs++;
        } catch (err2) {
          console.error(`  Thumb error ${identifier}: ${err2.message}`);
        }
      }

      if ((i + 1) % 50 === 0 || i === bags.length - 1) {
        console.log(`  Progress: ${i + 1}/${bags.length} (fixed: ${fixed}, uploaded: ${uploaded}, thumbs: ${thumbs})`);
      }
    } catch (err) {
      errors.push({ identifier, tokenId, error: err.message });
      console.error(`  ERROR ${identifier}: ${err.message}`);
    }
  }

  console.log('\n==================================================');
  console.log('FIX SUMMARY');
  console.log('==================================================');
  console.log(`SVGs patched:     ${fixed}`);
  console.log(`S3 uploads:       ${uploaded}`);
  console.log(`Thumbnails:       ${thumbs}`);
  console.log(`Errors:           ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nFailed bags:');
    errors.forEach(e => console.log(`  ${e.identifier} (#${e.tokenId}): ${e.error}`));
  }
  console.log('==================================================');

  // Verify 3 random samples
  console.log('\n=== Verification Samples ===\n');
  const samples = [bags[0], bags[174], bags[349]];
  for (const bag of samples) {
    const localPath = path.join(ROOT, 'output/svg', `${bag.identifier}.svg`);
    const svg = fs.readFileSync(localPath, 'utf8');
    const hasLotNo = /Lot No\. \/ ICO No\./.test(svg);
    const shipmentRef = svg.match(/Shipment Ref<\/text>\s*\n?\s*<text[^>]*>([^<]+)<\/text>/);
    const hasFarmAtY172 = /y="172"[^>]*>Farm Attestation/.test(svg);
    console.log(`${bag.identifier} (#${bag.tokenId}):`);
    console.log(`  Lot No. field: ${hasLotNo ? 'STILL PRESENT ✗' : 'REMOVED ✓'}`);
    console.log(`  Shipment Ref:  ${shipmentRef ? shipmentRef[1] : 'NOT FOUND'} ${shipmentRef && shipmentRef[1] === 'SC 2526.004' ? '✓' : '✗'}`);
    console.log(`  Farm Attest shifted: ${hasFarmAtY172 ? '✓' : '✗'}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
