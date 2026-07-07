// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {einput, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";

/// @title IConfidentialToken
/// @notice Interface for the Morphex confidential fungible token (ERC-7984 compatible).
/// @dev Balances and transfer amounts are FHE-encrypted. Public reads return ciphertext
/// handles — only ACL-authorized addresses can decrypt via the KMS gateway.
interface IConfidentialToken {
    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted on every transfer. Amount is intentionally omitted (encrypted).
    event Transfer(address indexed from, address indexed to);

    /// @notice Emitted when an encrypted allowance is set.
    event Approval(address indexed owner, address indexed spender);

    /// @notice Emitted when tokens are minted.
    event Mint(address indexed to);

    // ──────────────────────────────────────────────
    //  Public metadata (plaintext)
    // ──────────────────────────────────────────────

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);

    // ──────────────────────────────────────────────
    //  Encrypted state reads
    // ──────────────────────────────────────────────

    /// @notice Returns the encrypted balance handle for `account`.
    /// @dev Only `account` (or ACL-allowed addresses) can decrypt the underlying value
    /// through the KMS gateway.
    function balanceOf(address account) external view returns (euint64);

    /// @notice Returns the encrypted total supply handle.
    function totalSupply() external view returns (euint64);

    /// @notice Returns the encrypted allowance handle for `owner` → `spender`.
    function allowance(address owner, address spender) external view returns (euint64);

    // ──────────────────────────────────────────────
    //  Encrypted state writes
    // ──────────────────────────────────────────────

    /// @notice Transfer `encryptedAmount` tokens to `to`.
    /// @param to Recipient address.
    /// @param encryptedAmount Client-encrypted amount (einput handle).
    /// @param inputProof ZK proof binding the ciphertext to the caller.
    /// @return success Always true — insufficient balance resolves to a no-op
    /// (no revert, to prevent info leakage).
    function transfer(
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool success);

    /// @notice Approve `spender` to transfer up to `encryptedAmount` on your behalf.
    function approve(
        address spender,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool success);

    /// @notice Transfer `encryptedAmount` from `from` to `to`, consuming allowance.
    function transferFrom(
        address from,
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool success);
}
