// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IRelayerVault {
    function registerWithdrawalRequest(address user, address token, uint256 amount) external returns (uint256 requestId);
    function registerWithdrawalRequestTo(address user, address recipient, address token, uint256 amount) external returns (uint256 requestId);
}

contract MorphexToken is ERC7984, ZamaEthereumConfig, Ownable, AccessControl {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    address public relayerVault;
    address public underlyingToken;
    address public relayer;

    /// @dev Amounts are deliberately omitted from logs. The ERC-7984 transfer event
    /// carries an encrypted handle, and only ACL-authorized parties can decrypt it.
    event Mint(address indexed to);
    event RelayerVaultUpdated(address indexed vault);
    event RelayerUpdated(address indexed relayer);
    event UnderlyingTokenUpdated(address indexed token);
    event BurnRequested(address indexed user, uint256 indexed requestId, uint256 amount);
    event BurnRequestedTo(address indexed user, address indexed recipient, uint256 indexed requestId, uint256 amount);

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        address initialOwner
    ) ERC7984(tokenName, tokenSymbol, "") Ownable(initialOwner) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(RELAYER_ROLE, initialOwner);
        relayer = initialOwner;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC7984) returns (bool) {
        return AccessControl.supportsInterface(interfaceId) || ERC7984.supportsInterface(interfaceId);
    }

    /// @notice Sets the vault that records public withdrawal requests for this confidential token.
    function setRelayerVault(address vault) external onlyOwner {
        require(vault != address(0), "Morphex: zero vault");
        relayerVault = vault;
        emit RelayerVaultUpdated(vault);
    }

    /// @notice Sets the public stablecoin backing this confidential token (e.g. USDT/USDC).
    function setUnderlyingToken(address token) external onlyOwner {
        require(token != address(0), "Morphex: zero token");
        underlyingToken = token;
        emit UnderlyingTokenUpdated(token);
    }

    /// @notice Rotates the relayer signer/role used for confidential mint authorization.
    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "Morphex: zero relayer");
        if (relayer != address(0)) {
            _revokeRole(RELAYER_ROLE, relayer);
        }
        _grantRole(RELAYER_ROLE, newRelayer);
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    /// @notice Mints a confidential amount. Even issuance is encrypted on-chain.
    function mint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64) {
        euint64 encAmount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 transferred = _mint(to, encAmount);
        emit Mint(to);
        return transferred;
    }

    /// @notice Callable only by the relayer. Users trust the relayer to process the deposit honestly and promptly, or fall back to the escape hatch after the configured delay.
    function relayerMint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyRole(RELAYER_ROLE) returns (euint64) {
        euint64 encAmount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 transferred = _mint(to, encAmount);
        emit Mint(to);
        return transferred;
    }

    /// @notice Burns a caller's confidential balance and registers a public withdrawal request with the relayer vault.
    function relayerBurnRequest(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint256 publicAmount
    ) external returns (uint256 requestId) {
        require(relayerVault != address(0), "Morphex: no vault");
        require(underlyingToken != address(0), "Morphex: no underlying token");
        require(publicAmount > 0, "Morphex: zero amount");

        euint64 encAmount = FHE.fromExternal(encryptedAmount, inputProof);
        _burn(msg.sender, encAmount);
        requestId = IRelayerVault(relayerVault).registerWithdrawalRequest(msg.sender, underlyingToken, publicAmount);
        emit BurnRequested(msg.sender, requestId, publicAmount);
    }

    /// @notice Burns a caller's confidential balance and registers a public withdrawal to a different recipient.
    function relayerBurnRequestTo(
        address recipient,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint256 publicAmount
    ) external returns (uint256 requestId) {
        require(relayerVault != address(0), "Morphex: no vault");
        require(underlyingToken != address(0), "Morphex: no underlying token");
        require(recipient != address(0), "Morphex: zero recipient");
        require(publicAmount > 0, "Morphex: zero amount");

        euint64 encAmount = FHE.fromExternal(encryptedAmount, inputProof);
        _burn(msg.sender, encAmount);
        requestId = IRelayerVault(relayerVault).registerWithdrawalRequestTo(msg.sender, recipient, underlyingToken, publicAmount);
        emit BurnRequestedTo(msg.sender, recipient, requestId, publicAmount);
    }
}
