// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IConfidentialToken
/// @notice Confidential fungible token interface (ERC-7984 style). Balances/allowances are encrypted euint64 handles.
interface IConfidentialToken {
    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /// @dev No amounts in events — only that a transfer/approval happened.
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Encrypted balance handle for `account`.
    function confidentialBalanceOf(address account) external view returns (euint64);

    /// @notice Encrypted allowance handle for `owner` -> `spender`.
    function confidentialAllowance(address owner, address spender) external view returns (euint64);

    // ------------------------------------------------------------------
    // Standard confidential ERC-style entry points (client-encrypted input)
    // ------------------------------------------------------------------

    /// @notice Transfer using a client-encrypted amount + proof.
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    /// @notice Transfer using an existing euint64 handle.
    function confidentialTransfer(address to, euint64 amount) external returns (bool);

    /// @notice Approve using a client-encrypted amount + proof.
    function confidentialApprove(
        address spender,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    /// @notice Approve using an existing euint64 handle.
    function confidentialApprove(address spender, euint64 amount) external returns (bool);

    /// @notice TransferFrom using a client-encrypted amount + proof.
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool);

    /// @notice TransferFrom using an existing euint64 handle.
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (bool);

    // ------------------------------------------------------------------
    // Composability hooks (contract-to-contract, no client-side proof needed)
    // ------------------------------------------------------------------

    /// @notice Contract-to-contract transfer via handle (proofs can't be reused across contracts).
    /// @return newAmount actual amount transferred (may be clamped), returned so caller can update its own accounting.
    function transferHandle(address from, address to, euint64 amount) external returns (euint64 newAmount);

    /// @notice Contract-to-contract transferFrom via handle, respecting `from`'s encrypted allowance.
    function transferFromHandle(
        address spender,
        address from,
        address to,
        euint64 amount
    ) external returns (euint64 newAmount);
}