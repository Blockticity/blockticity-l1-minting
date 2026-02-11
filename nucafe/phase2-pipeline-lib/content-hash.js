/**
 * Content hash computation — port from coa-builder.html lines 2573–2607.
 * RFC8785 JSON Canonicalization + SHA-256 + GVE derivation.
 */
import { canonicalize } from 'json-canonicalize';
import { sha256 } from 'js-sha256';

/**
 * Create hashable copy of publicJson (excludes non-deterministic fields).
 * Matches coa-builder.html _createHashableJson() exactly.
 */
export function createHashableJson(publicJson) {
  const hashable = {};
  const excludeFields = ['verification', 'issuedAt'];

  for (const [key, value] of Object.entries(publicJson)) {
    if (excludeFields.includes(key)) continue;
    hashable[key] = value;
  }

  return hashable;
}

/**
 * Compute content hash from publicJson.
 * RFC8785 canonicalize → SHA-256 → 0x-prefixed hex.
 */
export function computeContentHash(publicJson) {
  const hashableJson = createHashableJson(publicJson);
  const canonical = canonicalize(hashableJson);
  const hash = sha256(canonical);
  return '0x' + hash;
}

/**
 * Derive GVE code from content hash.
 */
export function deriveGVE(contentHash) {
  return 'GVE-' + contentHash.slice(2, 10);
}
