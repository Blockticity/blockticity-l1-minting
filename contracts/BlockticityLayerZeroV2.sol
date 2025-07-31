// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BlockticityLayerZero
 * @notice ERC721 NFT contract for minting Certificates of Authenticity (COAs)
 * @dev Implements ASTM D8558 standard for blockchain COAs with LayerZero readiness
 */
contract BlockticityLayerZeroV2 is ERC721URIStorage, Ownable, Pausable, ReentrancyGuard {
    uint256 private _tokenIdCounter;
    
    // LayerZero readiness - can be integrated later
    address public layerZeroEndpoint;
    
    // Events
    event COAMinted(address indexed to, uint256 indexed tokenId, string uri);
    event LayerZeroEndpointSet(address indexed oldEndpoint, address indexed newEndpoint);
    event BatchMintCompleted(uint256 count, uint256 firstTokenId, uint256 lastTokenId);
    
    // Custom errors for gas optimization
    error InvalidAddress();
    error InvalidURI();
    error BatchSizeTooLarge();
    error ArrayLengthMismatch();
    
    constructor() ERC721("Blockticity COA", "BTIC") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }
    
    /**
     * @notice Mint a single COA NFT with metadata URI
     * @param to Recipient address
     * @param uri IPFS URI containing COA metadata
     */
    function mintURI(address to, string memory uri) public onlyOwner whenNotPaused {
        if (to == address(0)) revert InvalidAddress();
        if (bytes(uri).length == 0) revert InvalidURI();
        
        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit COAMinted(to, tokenId, uri);
    }
    
    /**
     * @notice Batch mint COAs for efficiency
     * @param recipients Array of recipient addresses
     * @param uris Array of metadata URIs
     */
    function batchMintURI(
        address[] calldata recipients,
        string[] calldata uris
    ) external onlyOwner whenNotPaused nonReentrant {
        uint256 length = recipients.length;
        if (length != uris.length) revert ArrayLengthMismatch();
        if (length > 100) revert BatchSizeTooLarge(); // Prevent gas limit issues
        
        uint256 firstTokenId = _tokenIdCounter + 1;
        
        for (uint256 i = 0; i < length; i++) {
            if (recipients[i] == address(0)) revert InvalidAddress();
            if (bytes(uris[i]).length == 0) revert InvalidURI();
            
            _tokenIdCounter += 1;
            uint256 tokenId = _tokenIdCounter;
            
            _mint(recipients[i], tokenId);
            _setTokenURI(tokenId, uris[i]);
            
            emit COAMinted(recipients[i], tokenId, uris[i]);
        }
        
        emit BatchMintCompleted(length, firstTokenId, _tokenIdCounter);
    }
    
    /**
     * @notice Get current token ID counter
     * @return Current token ID
     */
    function currentTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @notice Set LayerZero endpoint for future cross-chain functionality
     * @param _endpoint LayerZero endpoint address
     */
    function setLayerZeroEndpoint(address _endpoint) external onlyOwner {
        if (_endpoint == address(0)) revert InvalidAddress();
        address oldEndpoint = layerZeroEndpoint;
        layerZeroEndpoint = _endpoint;
        emit LayerZeroEndpointSet(oldEndpoint, _endpoint);
    }
    
    /**
     * @notice Pause contract operations
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause contract operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Override _update for pausable functionality
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override whenNotPaused returns (address) {
        return super._update(to, tokenId, auth);
    }
}