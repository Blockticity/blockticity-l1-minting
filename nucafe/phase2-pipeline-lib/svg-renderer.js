/**
 * SVG renderer — Node.js port of coa-builder.html SVG generation functions.
 * Approved design: product image (left) + table (right) + map (below product image).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pre-loaded assets as base64 data URLs
let nucafeLogoDataUrl = '';
let blockticitySealDataUrl = '';
let productImageDataUrl = '';
let mapImageDataUrl = '';
let qrLogoBuffer = null; // Raw buffer for canvas loadImage

export function initAssets(nucafeLogoPath, sealPath, productImagePath, mapImagePath, qrLogoPath) {
  if (nucafeLogoPath && fs.existsSync(nucafeLogoPath)) {
    const buf = fs.readFileSync(nucafeLogoPath);
    nucafeLogoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  }
  if (sealPath && fs.existsSync(sealPath)) {
    const buf = fs.readFileSync(sealPath);
    blockticitySealDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  }
  if (productImagePath && fs.existsSync(productImagePath)) {
    const buf = fs.readFileSync(productImagePath);
    productImageDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  }
  if (mapImagePath && fs.existsSync(mapImagePath)) {
    const buf = fs.readFileSync(mapImagePath);
    mapImageDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
  }
  if (qrLogoPath && fs.existsSync(qrLogoPath)) {
    qrLogoBuffer = fs.readFileSync(qrLogoPath);
  }
}

// ============================================================================
// XML ESCAPING
// ============================================================================

function escapeXml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ============================================================================
// QUINE TITLE BAR WATERMARK
// ============================================================================

function generateQuineTitleBar(data, x, y, width, height) {
  const elements = [];
  const hash = data.contentHash || '';

  const hashBytes = [];
  for (let i = 0; i < 32; i++) {
    const hex = hash.substring(i * 2, i * 2 + 2);
    hashBytes.push(parseInt(hex, 16) || 128);
  }

  const dataString = [
    hash,
    data.gveCode || 'GVE-00000000',
    data.tokenId ? 'TOKEN:' + data.tokenId : 'PENDING',
    (data.primaryLabel || 'ID') + ':' + (data.primaryValue || '?'),
    'DATE:' + (data.prodDate || '?'),
    'QTY:' + (data.quantity || '?'),
    hash.split('').reverse().join(''),
    'BLOCKTICITY-VERIFIED'
  ].join('');

  const cellSize = 5;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const fontSize = cellSize * 0.8;

  let charIndex = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = x + col * cellSize;
      const cellY = y + row * cellSize;
      const char = dataString[charIndex % dataString.length];
      charIndex++;

      const byteIndex = (row * cols + col) % 32;
      const byteValue = hashBytes[byteIndex];
      const opacity = 0.08 + (byteValue / 255) * 0.17;
      const isDark = byteValue % 3 === 0;
      const color = isDark ? '#046A6F' : '#3DBDC3';

      const textX = cellX + cellSize / 2;
      const textY = cellY + cellSize / 2 + fontSize * 0.3;

      elements.push(
        `<text x="${textX.toFixed(1)}" y="${textY.toFixed(1)}" font-family="monospace" font-size="${fontSize.toFixed(1)}" font-weight="bold" fill="${color}" opacity="${opacity.toFixed(3)}" text-anchor="middle">${char}</text>`
      );
    }
  }

  return `<g class="quine-title-bar-watermark" clip-path="url(#titleBarClip)">
    ${elements.join('\n    ')}
  </g>`;
}

// ============================================================================
// FINGERPRINT BAR
// ============================================================================

function generateQuineFingerprintBar(hash, x, y, width) {
  const bars = [];
  const numBars = 32;
  const gap = 1;
  const barWidth = (width - (numBars - 1) * gap) / numBars;
  const maxBarHeight = 16;
  const minBarHeight = 4;

  for (let i = 0; i < numBars; i++) {
    const hexPair = hash.substring(i * 2, i * 2 + 2);
    const byteValue = parseInt(hexPair, 16) || 0;
    const normalizedValue = byteValue / 255;
    const barHeight = minBarHeight + normalizedValue * maxBarHeight;
    const bx = x + i * (barWidth + gap);
    const by = y + (20 - barHeight) / 2;

    bars.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="#5BD1D7"/>`);
  }

  return bars.join('\n      ');
}

// ============================================================================
// TABLE ROWS
// ============================================================================

function generateTableRows(data, maxRows, tableWidth) {
  const fields = data.productFields || [];
  const rows = fields.slice(1).map(f => ({
    label: f.label,
    value: f.value || 'N/A'
  }));

  const totalRows = rows.length;
  const hiddenCount = Math.max(0, totalRows - maxRows);
  const maxDisplay = hiddenCount > 0 ? maxRows - 1 : maxRows;
  const displayRows = rows.slice(0, maxDisplay);

  const valueMaxChars = Math.floor((tableWidth / 2 - 20) / 5.5);

  let rowsHtml = displayRows.map((row, i) => {
    const y = 30 + i * 25;
    const displayValue = row.value.length > valueMaxChars ? row.value.slice(0, valueMaxChars - 3) + '...' : row.value;
    return `
    <rect x="0" y="${y}" width="${tableWidth}" height="25" fill="#FFFFFF" stroke="#E8E8E8" stroke-width="0.5"/>
    <text x="10" y="${y + 17}" font-family="Arial" font-size="9" fill="#5A5A5A">${escapeXml(row.label)}</text>
    <text x="${tableWidth / 2 + 10}" y="${y + 17}" font-family="Arial" font-size="9" font-weight="bold" fill="#5A5A5A">${escapeXml(displayValue)}</text>`;
  }).join('');

  if (hiddenCount > 0) {
    const indicatorY = 30 + maxDisplay * 25;
    rowsHtml += `
    <rect x="0" y="${indicatorY}" width="${tableWidth}" height="25" fill="#F5FAFA" stroke="#E8E8E8" stroke-width="0.5"/>
    <text x="${tableWidth / 2}" y="${indicatorY + 17}" font-family="Arial" font-size="9" font-style="italic" fill="#089CA2" text-anchor="middle">+ ${hiddenCount} more field${hiddenCount > 1 ? 's' : ''} in metadata</text>`;
  }

  return rowsHtml;
}

// ============================================================================
// BLOCKS DENSE PATTERN (96×4 grid)
// ============================================================================

function generateBlocksDensePattern(seed, x, y, width, height) {
  let svg = '';
  svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#F8F9FA" rx="4"/>`;
  svg += `<text x="${x + width / 2}" y="${y + 10}" font-family="Arial" font-size="7" fill="#089CA2" text-anchor="middle">VERIFICATION PATTERN</text>`;

  const gridArea = { x: x + 8, y: y + 14, width: width - 16, height: height - 18 };
  const cols = 96;
  const rows = 4;
  const cellWidth = gridArea.width / cols;
  const cellHeight = gridArea.height / rows;
  const gap = 0.5;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hashIndex = ((row * cols + col) * 2) % (seed.length - 2);
      const value = parseInt(seed.substring(hashIndex, hashIndex + 2), 16) / 255;

      const bx = gridArea.x + col * cellWidth;
      const by = gridArea.y + row * cellHeight;

      const filled = value > 0.25;
      const color = value > 0.75 ? '#5BD1D7' : value > 0.5 ? '#089CA2' : value > 0.35 ? '#6DD3D8' : '#B8E8EA';

      if (filled) {
        svg += `<rect x="${(bx + gap / 2).toFixed(1)}" y="${(by + gap / 2).toFixed(1)}" width="${(cellWidth - gap).toFixed(1)}" height="${(cellHeight - gap).toFixed(1)}" fill="${color}" rx="0.5"/>`;
      }
    }
  }

  svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#E0E0E0" stroke-width="1" rx="4"/>`;
  return svg;
}

function generateHorizontalLattice(contentHash, x, y, width, height) {
  if (!contentHash) return '';
  const cleanSeed = contentHash.startsWith('0x') ? contentHash.slice(2) : contentHash;
  return generateBlocksDensePattern(cleanSeed, x, y, width, height);
}

// ============================================================================
// QR CODE GENERATION — exact match of qr-generator.js (production standard)
// ============================================================================

const QR_SIZE = 400;
const LOGO_SIZE_PERCENT = 22;
const LOGO_PADDING_PERCENT = 28;

async function generateQrDataUrl(contentHash, tokenId, gveCode) {
  // URL: app.blockticity.io/coa/{tokenId} (matches production qr-generator.js)
  let url;
  if (tokenId && String(tokenId).trim()) {
    url = `https://app.blockticity.io/coa/${String(tokenId).trim()}`;
  } else if (gveCode) {
    url = `https://app.blockticity.io/coa/${gveCode}`;
  } else {
    url = `https://app.blockticity.io/${contentHash}`;
  }

  // Generate QR directly onto canvas (same as qr-generator.js)
  const canvas = createCanvas(QR_SIZE, QR_SIZE);
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: QR_SIZE,
    color: { dark: '#000000', light: '#FFFFFF' }
  });

  const ctx = canvas.getContext('2d');

  // Overlay Blockticity logo if available (same sizing as qr-generator.js)
  if (qrLogoBuffer) {
    const logo = await loadImage(qrLogoBuffer);

    const logoSize = QR_SIZE * (LOGO_SIZE_PERCENT / 100);
    const logoX = (QR_SIZE - logoSize) / 2;
    const logoY = (QR_SIZE - logoSize) / 2;

    const paddingSize = QR_SIZE * (LOGO_PADDING_PERCENT / 100);

    // White circular background (matches the circular logo)
    ctx.beginPath();
    ctx.arc(QR_SIZE / 2, QR_SIZE / 2, paddingSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Draw logo
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  }

  return canvas.toDataURL('image/png');
}

// ============================================================================
// MAIN SVG GENERATION — Approved design with product image + map
// ============================================================================

export async function renderBagSVG(renderData) {
  if (!renderData.qrDataUrl) {
    renderData.qrDataUrl = await generateQrDataUrl(renderData.contentHash, renderData.tokenId, renderData.gveCode);
  }

  const hashClean = renderData.contentHash.startsWith('0x') ? renderData.contentHash.slice(2) : renderData.contentHash;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -2 810 1104" width="800" height="1100">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#5BD1D7"/>
      <stop offset="100%" style="stop-color:#089CA2"/>
    </linearGradient>
    <clipPath id="titleBarClip">
      <rect x="20" y="130" width="760" height="40" rx="4"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="800" height="1100" fill="#FFFFFF"/>

  <!-- Header Area -->
  <rect x="20" y="20" width="760" height="100" fill="#FFFFFF" rx="8"/>

  <!-- Company Logo (small, top-left) -->
  ${nucafeLogoDataUrl ? `<image x="40" y="30" width="140" height="45" href="${nucafeLogoDataUrl}" preserveAspectRatio="xMidYMid meet"/>` : ''}

  <!-- Company Info -->
  <text x="40" y="90" font-family="Arial" font-size="7" fill="#5A5A5A">Company Name: ${escapeXml(renderData.issuerName)}</text>
  <text x="40" y="100" font-family="Arial" font-size="7" fill="#5A5A5A">Address: ${escapeXml(renderData.issuerAddress)}</text>

  <!-- Blockticity Seal -->
  ${blockticitySealDataUrl ? `<image x="355" y="25" width="90" height="90" href="${blockticitySealDataUrl}" preserveAspectRatio="xMidYMid meet"/>` : ''}

  <!-- QR Code -->
  ${renderData.qrDataUrl ? `<image x="670" y="25" width="90" height="90" href="${renderData.qrDataUrl}" preserveAspectRatio="xMidYMid meet"/>` : ''}

  <!-- Header Border -->
  <rect x="20" y="20" width="760" height="100" fill="none" stroke="#E0E0E0" stroke-width="1.5" rx="8"/>

  <!-- Title Bar -->
  <rect x="20" y="130" width="760" height="40" fill="url(#headerGrad)" rx="4"/>
  ${generateQuineTitleBar(renderData, 20, 130, 760, 40)}
  <text x="400" y="157" font-family="Arial" font-size="18" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${escapeXml(renderData.certificateTitle)}</text>

  <!-- Product Title -->
  <text x="400" y="195" font-family="Arial" font-size="16" font-weight="bold" fill="#5A5A5A" text-anchor="middle">${escapeXml(renderData.productName)}</text>
  <text x="400" y="212" font-family="Arial" font-size="10" fill="#5A5A5A" text-anchor="middle">${escapeXml(renderData.productDescription || '')}</text>

  <!-- Main Content Area -->
  <rect x="20" y="220" width="760" height="540" fill="#FFFFFF" rx="8"/>

  <!-- Product Image (left panel) -->
  <rect x="40" y="240" width="320" height="265" fill="#FFFFFF" rx="4"/>
  ${productImageDataUrl ? `<image x="45" y="245" width="310" height="255" href="${productImageDataUrl}" preserveAspectRatio="xMidYMid meet"/>` : ''}
  <rect x="40" y="240" width="320" height="265" fill="none" stroke="#E0E0E0" stroke-width="1.5" rx="4"/>

  <!-- Data Table (right side, 18 rows max) -->
  <g transform="translate(380, 240)">
    <rect x="0" y="0" width="380" height="30" fill="#5BD1D7"/>
    <text x="100" y="20" font-family="Arial" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${escapeXml(renderData.primaryLabel.toUpperCase())}</text>
    <text x="280" y="20" font-family="Arial" font-size="11" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${escapeXml(renderData.primaryValue)}</text>
    ${generateTableRows(renderData, 18, 380)}
  </g>

  <!-- Geo Section (below product image) -->
  <rect x="40" y="510" width="320" height="245" fill="#FFFFFF" rx="4"/>
  <text x="200" y="530" font-family="Arial" font-size="10" font-weight="bold" fill="#5A5A5A" text-anchor="middle">GEO SPATIAL COORDINATES</text>
  ${mapImageDataUrl ? `<image x="55" y="540" width="290" height="200" href="${mapImageDataUrl}" preserveAspectRatio="xMidYMid meet"/>` : `<text x="200" y="640" font-family="Arial" font-size="12" fill="#999" text-anchor="middle">Map Image</text>`}
  ${renderData.latitude && renderData.longitude ? `<text x="200" y="750" font-family="Arial" font-size="8" fill="#666" text-anchor="middle">${renderData.latitude}, ${renderData.longitude}</text>` : ''}
  <rect x="40" y="510" width="320" height="245" fill="none" stroke="#E0E0E0" stroke-width="1.5" rx="4"/>

  <!-- Main Border -->
  <rect x="20" y="220" width="760" height="540" fill="none" stroke="#E0E0E0" stroke-width="1.5" rx="8"/>

  <!-- Auth Banner -->
  <rect x="20" y="770" width="760" height="30" fill="#5BD1D7" rx="4"/>
  <text x="400" y="790" font-family="Arial" font-size="10" font-weight="bold" fill="#FFFFFF" text-anchor="middle">~ TO AUTHENTICATE THIS CoA SCAN QR CODE TOP RIGHT CORNER ~</text>

  <!-- GVE Section -->
  <rect x="20" y="810" width="760" height="55" fill="#F8F8F8" rx="4"/>
  <text x="40" y="830" font-family="Arial" font-size="9" fill="#5A5A5A">Generative Visual Encoding (GVE):</text>
  <text x="200" y="830" font-family="monospace" font-size="11" font-weight="bold" fill="#089CA2">${escapeXml(renderData.gveCode)}</text>

  <g transform="translate(40, 838)">
    ${generateQuineFingerprintBar(hashClean, 0, 0, 180)}
  </g>
  <text x="230" y="855" font-family="Arial" font-size="6" fill="#5A5A5A">Document Fingerprint</text>

  <text x="280" y="830" font-family="Arial" font-size="8" fill="#5A5A5A">Content Hash:</text>
  <text x="370" y="830" font-family="monospace" font-size="7" fill="#5A5A5A">${renderData.contentHash.substring(0, 34)}</text>
  <text x="370" y="842" font-family="monospace" font-size="7" fill="#5A5A5A">${renderData.contentHash.substring(34)}</text>

  <text x="640" y="830" font-family="Arial" font-size="8" fill="#5A5A5A">Token ID:</text>
  <text x="700" y="830" font-family="monospace" font-size="12" font-weight="bold" fill="${renderData.tokenId ? '#5BD1D7' : '#999'}">${renderData.tokenId ? '#' + renderData.tokenId : 'PENDING'}</text>

  <rect x="20" y="810" width="760" height="55" fill="none" stroke="#E0E0E0" stroke-width="1.5" rx="4"/>

  <!-- Horizontal Verification Lattice -->
  ${generateHorizontalLattice(renderData.contentHash, 20, 875, 760, 35)}

  <!-- Disclaimer -->
  <text x="400" y="930" font-family="Arial" font-size="7" fill="#5A5A5A" text-anchor="middle">This certificate is cryptographically verifiable on the Blockticity blockchain. Scan the QR code or visit blockticity.io to verify authenticity.</text>
  <text x="400" y="943" font-family="Arial" font-size="7" fill="#5A5A5A" text-anchor="middle">Verification: app.blockticity.io/verify/${renderData.contentHash.slice(0, 16)}...</text>
</svg>`;

  return svg;
}
