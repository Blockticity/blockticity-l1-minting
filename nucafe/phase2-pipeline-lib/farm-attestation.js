/**
 * Standalone farm attestation hash computation.
 * Matches coa-builder.html line 5574: sortedHashes.sort().join('') → sha256
 */
import { sha256 } from 'js-sha256';

/**
 * Compute the farm attestation hash from an array of content hashes.
 * @param {string[]} contentHashes — 0x-prefixed content hashes
 * @returns {string} 0x-prefixed SHA-256 attestation hash
 */
export function computeFarmAttestationHash(contentHashes) {
  if (!contentHashes || contentHashes.length === 0) {
    throw new Error('No content hashes provided');
  }

  // Sort alphabetically (matching browser sort — lexicographic on 0x-prefixed strings)
  const sorted = [...contentHashes].sort();

  // Join into single string, then SHA-256
  const joined = sorted.join('');
  return '0x' + sha256(joined);
}
