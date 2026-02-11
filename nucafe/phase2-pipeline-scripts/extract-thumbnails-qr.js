#!/usr/bin/env node
/**
 * Extract COA thumbnails and QR codes from 350 Phase 2 bag SVGs.
 *
 * 1. COA thumbnail: full SVG → 120×80 PNG
 * 2. QR print:      embedded QR PNG → 600×600
 * 3. QR thumb:      embedded QR PNG → 60×60
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const NUCAFE = path.resolve(ROOT, '..');

const THUMB_DIR   = path.join(NUCAFE, 'phase2-coa-thumbnails');
const QR_PRINT    = path.join(NUCAFE, 'phase2-qr-print');
const QR_THUMB    = path.join(NUCAFE, 'phase2-qr-thumbs');

const CONCURRENCY = 10;

async function main() {
  console.log('=== Extract COA Thumbnails + QR Codes (Phase 2) ===\n');

  const mintLog = JSON.parse(fs.readFileSync(path.join(NUCAFE, 'phase2-mint-log.json'), 'utf8'));
  const bags = mintLog.bags;
  console.log(`Bags: ${bags.length}`);

  // Also try local SVGs first (faster than S3 fetch)
  const localSvgDir = path.join(ROOT, 'output/svg');
  const hasLocalSvgs = fs.existsSync(localSvgDir);
  if (hasLocalSvgs) {
    console.log(`Using local SVGs from output/svg/`);
  }

  let completed = 0;
  let qrExtracted = 0;
  let qrMissing = 0;
  let fetchErrors = 0;

  // Process in concurrent batches
  for (let i = 0; i < bags.length; i += CONCURRENCY) {
    const batch = bags.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (bag) => {
      const { tokenId, s3Url, identifier } = bag;
      let svgContent = null;

      // Try local file first
      const localFile = path.join(localSvgDir, `${identifier}.svg`);
      if (hasLocalSvgs && fs.existsSync(localFile)) {
        svgContent = fs.readFileSync(localFile, 'utf8');
      } else if (s3Url) {
        // Fetch from S3
        try {
          const resp = await fetch(s3Url);
          if (resp.ok) {
            svgContent = await resp.text();
          }
        } catch (err) {
          console.error(`  Fetch error ${identifier}: ${err.message}`);
          fetchErrors++;
          return;
        }
      }

      if (!svgContent) {
        console.error(`  No SVG for ${identifier}`);
        fetchErrors++;
        return;
      }

      // 1. COA Thumbnail — full SVG → 120×80 PNG
      try {
        const thumbPng = await sharp(Buffer.from(svgContent))
          .resize(120, 80, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer();
        fs.writeFileSync(path.join(THUMB_DIR, `${tokenId}.png`), thumbPng);
      } catch (err) {
        // sharp SVG rendering can be finicky — try with density
        try {
          const thumbPng = await sharp(Buffer.from(svgContent), { density: 72 })
            .resize(120, 80, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .png()
            .toBuffer();
          fs.writeFileSync(path.join(THUMB_DIR, `${tokenId}.png`), thumbPng);
        } catch (err2) {
          console.error(`  Thumb error ${identifier}: ${err2.message}`);
        }
      }

      // 2. Extract QR code from embedded base64 PNG in SVG
      //    The QR is: <image x="670" y="25" width="90" height="90" href="data:image/png;base64,..." />
      const qrMatch = svgContent.match(/x="670"[^>]*href="data:image\/png;base64,([^"]+)"/);
      if (qrMatch) {
        const qrBuffer = Buffer.from(qrMatch[1], 'base64');

        // 600×600 print version
        const qrPrint = await sharp(qrBuffer)
          .resize(600, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer();
        fs.writeFileSync(path.join(QR_PRINT, `${tokenId}.png`), qrPrint);

        // 60×60 spreadsheet thumbnail
        const qrSmall = await sharp(qrBuffer)
          .resize(60, 60, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
          .png()
          .toBuffer();
        fs.writeFileSync(path.join(QR_THUMB, `${tokenId}.png`), qrSmall);

        qrExtracted++;
      } else {
        // Try alternate pattern (href might come before x)
        const altMatch = svgContent.match(/href="data:image\/png;base64,([^"]+)"[^>]*x="670"/);
        if (altMatch) {
          const qrBuffer = Buffer.from(altMatch[1], 'base64');
          const qrPrint = await sharp(qrBuffer)
            .resize(600, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .png()
            .toBuffer();
          fs.writeFileSync(path.join(QR_PRINT, `${tokenId}.png`), qrPrint);

          const qrSmall = await sharp(qrBuffer)
            .resize(60, 60, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .png()
            .toBuffer();
          fs.writeFileSync(path.join(QR_THUMB, `${tokenId}.png`), qrSmall);
          qrExtracted++;
        } else {
          qrMissing++;
          console.warn(`  No QR found in ${identifier}`);
        }
      }

      completed++;
      if (completed % 50 === 0 || completed === bags.length) {
        console.log(`  Processed: ${completed}/${bags.length}`);
      }
    }));
  }

  console.log('\n==================================================');
  console.log('EXTRACTION SUMMARY');
  console.log('==================================================');
  console.log(`COA thumbnails:  ${completed} → ${THUMB_DIR}`);
  console.log(`QR print (600):  ${qrExtracted} → ${QR_PRINT}`);
  console.log(`QR thumbs (60):  ${qrExtracted} → ${QR_THUMB}`);
  if (qrMissing > 0) console.log(`QR missing:      ${qrMissing}`);
  if (fetchErrors > 0) console.log(`Fetch errors:    ${fetchErrors}`);
  console.log('==================================================\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
