#!/usr/bin/env node
/**
 * Upload 350 Phase 2 print-ready QR PNGs to S3 alongside their COA SVGs.
 * Path: s3://blockticity-coa-uploads/GVE-{hash}/qr-{tokenId}.png
 * Writes mapping file to ../phase2-qr-s3-urls.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const NUCAFE = path.resolve(ROOT, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET = 'blockticity-coa-uploads';
const QR_DIR = path.join(NUCAFE, 'phase2-qr-print');
const CONCURRENCY = 10;

async function uploadOne(key, body) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: 'image/png',
    CacheControl: 'no-cache, no-store, must-revalidate'
  }));
}

async function main() {
  console.log('=== Upload Phase 2 QR PNGs to S3 ===\n');

  const mintLog = JSON.parse(fs.readFileSync(path.join(NUCAFE, 'phase2-mint-log.json'), 'utf8'));
  const bags = mintLog.bags;
  console.log(`QR codes to upload: ${bags.length}\n`);

  const mapping = {};
  let uploaded = 0;
  let errors = [];

  for (let i = 0; i < bags.length; i += CONCURRENCY) {
    const batch = bags.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (bag) => {
      const { tokenId, gveCode } = bag;
      const localFile = path.join(QR_DIR, `${tokenId}.png`);

      if (!fs.existsSync(localFile)) {
        errors.push({ tokenId, error: 'File not found' });
        return;
      }

      try {
        const body = fs.readFileSync(localFile);
        const s3Key = `${gveCode}/qr-${tokenId}.png`;
        await uploadOne(s3Key, body);
        const url = `https://${BUCKET}.s3.us-east-1.amazonaws.com/${s3Key}`;
        mapping[tokenId] = url;
        uploaded++;
      } catch (err) {
        errors.push({ tokenId, error: err.message });
      }
    }));

    const done = Math.min(i + CONCURRENCY, bags.length);
    if (done % 50 === 0 || done === bags.length) {
      console.log(`  Uploaded: ${uploaded}/${bags.length}`);
    }
  }

  // Write mapping file
  const mappingPath = path.join(NUCAFE, 'phase2-qr-s3-urls.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));

  console.log('\n==================================================');
  console.log('UPLOAD SUMMARY');
  console.log('==================================================');
  console.log(`Uploaded:     ${uploaded}`);
  console.log(`Errors:       ${errors.length}`);
  console.log(`Mapping file: ${mappingPath}`);
  if (errors.length > 0) {
    console.log('\nFailed:');
    errors.forEach(e => console.log(`  #${e.tokenId}: ${e.error}`));
  }
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
