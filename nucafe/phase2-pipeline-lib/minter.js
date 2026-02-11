/**
 * Blockchain minter — ethers.js mintURI + batchMintURI.
 * Matches server.cjs NFT metadata structure (lines 627–647).
 */
import { ethers } from 'ethers';

const MINT_ABI = [
  'function mintURI(address to, string uri) returns (uint256)',
  'function batchMintURI(address[] recipients, string[] uris)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

let provider = null;
let wallet = null;
let contract = null;
let contractAddress = null;

export function initMinter(rpcUrl, privateKey, contractAddr) {
  provider = new ethers.JsonRpcProvider(rpcUrl);
  wallet = new ethers.Wallet(privateKey, provider);
  contractAddress = contractAddr;
  contract = new ethers.Contract(contractAddr, MINT_ABI, wallet);
}

export function getProvider() { return provider; }
export function getContract() { return contract; }
export function getWallet() { return wallet; }

/**
 * Build NFT metadata matching server.cjs structure.
 */
export function buildNftMetadata(publicJson, contentHash, gveCode, imageUrl, config) {
  const productName = config.productName || 'NuCafe Green Coffee';
  const issuerName = config.issuer.name;
  const networkName = config.chain.name;

  const nftMetadata = {
    name: `COA: ${productName}`,
    description: `Blockticity Certificate of Authenticity issued by ${issuerName}. GVE: ${gveCode}. Verify at app.blockticity.ai`,
    image: imageUrl,
    external_url: `https://app.blockticity.ai/${contentHash}`,
    attributes: [
      { trait_type: 'Issuer', value: issuerName },
      { trait_type: 'GVE Code', value: gveCode },
      { trait_type: 'Content Hash', value: contentHash },
      { trait_type: 'Standard', value: 'ASTM D8558' },
      { trait_type: 'Network', value: networkName }
    ],
    blockticity: publicJson
  };

  return nftMetadata;
}

/**
 * Encode metadata as base64 data URI tokenURI.
 */
export function encodeTokenURI(nftMetadata) {
  const jsonString = JSON.stringify(nftMetadata);
  const base64 = Buffer.from(jsonString, 'utf-8').toString('base64');
  return `data:application/json;base64,${base64}`;
}

/**
 * Mint a single NFT.
 * @returns {{ tokenId: string, txHash: string, gasUsed: string }}
 */
export async function mintSingle(toAddress, tokenURI) {
  const gasEstimate = await contract.mintURI.estimateGas(toAddress, tokenURI);
  const tx = await contract.mintURI(toAddress, tokenURI, {
    gasLimit: gasEstimate * 2n
  });
  const receipt = await Promise.race([
    tx.wait(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout (60s)')), 60000))
  ]);
  if (!receipt) throw new Error('No receipt returned');

  // Extract token ID from Transfer event
  const transferEvent = receipt.logs.find(log => {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      return parsed?.name === 'Transfer';
    } catch { return false; }
  });

  let tokenId = null;
  if (transferEvent) {
    const parsed = contract.interface.parseLog({ topics: transferEvent.topics, data: transferEvent.data });
    tokenId = parsed.args[2].toString();
  }

  return {
    tokenId,
    txHash: receipt.hash,
    gasUsed: receipt.gasUsed.toString()
  };
}

/**
 * Batch mint NFTs.
 * @returns {{ tokenIds: string[], txHash: string, gasUsed: string }}
 */
export async function mintBatch(recipients, tokenURIs) {
  const gasEstimate = await contract.batchMintURI.estimateGas(recipients, tokenURIs);
  const tx = await contract.batchMintURI(recipients, tokenURIs, {
    gasLimit: gasEstimate * 2n
  });
  const receipt = await tx.wait();

  // Extract all token IDs from Transfer events
  const tokenIds = [];
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === 'Transfer') {
        tokenIds.push(parsed.args[2].toString());
      }
    } catch { /* skip non-Transfer logs */ }
  }

  return {
    tokenIds,
    txHash: receipt.hash,
    gasUsed: receipt.gasUsed.toString()
  };
}

/**
 * Read tokenURI from chain (for verification).
 */
export async function readTokenURI(tokenId) {
  const readContract = new ethers.Contract(contractAddress, MINT_ABI, provider);
  return readContract.tokenURI(tokenId);
}

/**
 * Check wallet balance.
 */
export async function getBalance() {
  const balance = await provider.getBalance(wallet.address);
  return ethers.formatEther(balance);
}
