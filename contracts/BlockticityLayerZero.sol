// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BlockticityLayerZero is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    constructor() ERC721("Blockticity COA", "BTIC") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    function mintURI(address to, string memory uri) public onlyOwner {
        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;

        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function currentTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
