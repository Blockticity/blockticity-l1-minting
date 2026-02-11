/**
 * S3 uploader — matches server.cjs pattern for COA SVG uploads.
 * Upload path: {gveCode}/coa-{hash16}.svg
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';

let s3Client = null;
let s3Bucket = null;
let s3Region = null;

export function initS3(config) {
  s3Bucket = config.bucket || 'blockticity-coa-uploads';
  s3Region = config.region || 'us-east-1';
  const profile = process.env.AWS_PROFILE || 'blockticity';

  s3Client = new S3Client({
    region: s3Region,
    credentials: fromIni({ profile })
  });
}

/**
 * Upload a single SVG to S3.
 * @param {string} svg — SVG content
 * @param {string} gveCode — e.g. "GVE-a020348f"
 * @param {string} contentHash — 0x-prefixed content hash
 * @returns {{ url: string, filename: string, size: number }}
 */
export async function uploadSVG(svg, gveCode, contentHash) {
  if (!s3Client) throw new Error('S3 not initialized — call initS3() first');

  const buffer = Buffer.from(svg, 'utf-8');
  const hash16 = contentHash.substring(2, 18);
  const filename = `${gveCode}/coa-${hash16}.svg`;

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: filename,
    Body: buffer,
    ContentType: 'image/svg+xml',
    CacheControl: 'no-cache, no-store, must-revalidate'
  });

  await s3Client.send(command);

  const url = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${filename}`;

  return { url, filename, size: buffer.length };
}

/**
 * Upload multiple SVGs concurrently.
 * @param {Array<{svg, gveCode, contentHash}>} items
 * @param {number} concurrency — max concurrent uploads
 * @returns {Array<{url, filename, size}>}
 */
export async function uploadBatch(items, concurrency = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item => uploadSVG(item.svg, item.gveCode, item.contentHash))
    );
    results.push(...batchResults);
  }
  return results;
}
