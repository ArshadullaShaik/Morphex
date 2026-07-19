// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
contract MorphexToken is ERC7984, ZamaEthereumConfig, Ownable {
    event Mint(address indexed to, euint64 indexed amount);

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        address initialOwner
    ) ERC7984(tokenName, tokenSymbol, "") Ownable(initialOwner) {}

    function mint(address to, uint64 amount) external onlyOwner {
        euint64 encAmount = FHE.asEuint64(amount);
        euint64 transferred = _mint(to, encAmount);
        emit Mint(to, transferred);
    }
}