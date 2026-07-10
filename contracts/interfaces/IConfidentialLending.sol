// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IConfidentialLending
/// @notice Single-collateral / single-debt lending pool. Collateral and debt are encrypted, so a
///         position's health stays hidden from on-chain observers (including liquidation bots) until
///         a liquidator actually submits an attempt.
interface IConfidentialLending {
    event CollateralDeposited(address indexed account);
    event CollateralWithdrawn(address indexed account);
    event Borrowed(address indexed account);
    event Repaid(address indexed account);
    event LiquidationAttempted(address indexed account, address indexed liquidator);

    function collateralBalanceOf(address account) external view returns (euint64);
    function debtBalanceOf(address account) external view returns (euint64);
    function depositCollateral(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (bool);
    function withdrawCollateral(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (bool);
    function borrow(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (bool);
    function repay(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (bool);

    /// @notice Anyone can attempt to liquidate any account. Only executes if the encrypted health
    ///         check shows the position is actually undercollateralized; otherwise it's a silent
    ///         no-op, so a failed attempt reveals nothing about the target's real health.
    function liquidate(
        address account,
        externalEuint64 encryptedRepayAmount,
        bytes calldata inputProof
    ) external returns (bool);
}