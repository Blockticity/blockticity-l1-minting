/**
 * Public JSON builder for bag COAs — port from coa-builder.html lines 2473–2567.
 */

/**
 * Build publicJson for a single bag COA.
 * @param {number} serialNumber — 1..350
 * @param {string} lotNumber — e.g. "489"
 * @param {object} config — from nucafe-phase2.config.json
 * @param {object} farmAttestation — from data/farm-attestation.json
 * @returns {object} publicJson
 */
export function buildBagPublicJson(serialNumber, lotNumber, config, farmAttestation) {
  const serialStr = String(serialNumber).padStart(3, '0');
  const identifier = `${config.serialPrefix}-${serialStr}`;

  // Build productData from bagFields
  const productData = {};
  const allFields = [
    { label: 'Bag Serial', value: identifier },
    ...config.bagFields,
    { label: 'Lot No. / ICO No.', value: lotNumber },
    { label: 'Farm Attestation', value: farmAttestation.farmAttestationHash }
  ];

  allFields.forEach(field => {
    const key = field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    productData[key] = field.value;
  });

  const publicJson = {
    schema: {
      id: 'urn:blockticity:coa:public',
      version: '1.0.0',
      standard: 'ASTM D8558'
    },
    verificationRecipe: {
      id: 'urn:blockticity:verify-recipe:v1',
      contentHash: {
        canonicalization: 'RFC8785-JCS',
        algo: 'sha256',
        profile: 'public-v1'
      },
      anchors: [
        { type: 'signature' },
        { type: 'chain', method: 'blockticity-l1' }
      ]
    },
    rendererRecipe: {
      id: 'urn:blockticity:render-recipe:v1',
      constraints: {
        deterministicPrng: true,
        noNetworkCalls: true,
        allowedFonts: ['Arial', 'Helvetica', 'sans-serif', 'monospace']
      }
    },
    chain: {
      chainId: config.chain.chainId,
      name: config.chain.name,
      contract: config.chain.contract
    },
    issuer: {
      name: config.issuer.name,
      id: 'did:web:' + config.issuer.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.blockticity.io',
      address: config.issuer.address
    },
    identifier: {
      label: 'Bag Serial',
      value: identifier
    },
    productData,
    fields: allFields.map(f => ({ label: f.label, value: f.value })),

    // sourceAttestation links every bag to all 42 farm COAs
    sourceAttestation: {
      farmAttestationHash: farmAttestation.farmAttestationHash,
      farmCount: farmAttestation.farmTokenIds.length,
      chain: {
        chainId: config.chain.chainId,
        contract: config.chain.contract
      },
      farmTokenIds: farmAttestation.farmTokenIds
    }
  };

  return publicJson;
}
