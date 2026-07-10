// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IConfidentialSwap
/// @notice Constant-product AMM (x*y=k) for two ConfidentialTokens. Reserves, LP shares, and swap
///         amounts are all encrypted; only the pool's existence and token pair are public.
interface IConfidentialSwap {
    event LiquidityAdded(address indexed provider);
    event LiquidityRemoved(address indexed provider);
    event Swap(address indexed trader, bool indexed zeroForOne);

    /// @notice Encrypted current reserves.
    function encryptedReserves() external view returns (euint64 reserve0, euint64 reserve1);

    /// @notice Encrypted LP share balance of `provider`.
    function lpBalanceOf(address provider) external view returns (euint64);

    /// @notice Add liquidity using client-encrypted amounts for both tokens.
    function addLiquidity(
        externalEuint64 encryptedAmount0,
        externalEuint64 encryptedAmount1,
        bytes calldata amount0Proof,
        bytes calldata amount1Proof
    ) external returns (bool);

    /// @notice Remove liquidity for an encrypted amount of LP shares.
    function removeLiquidity(externalEuint64 encryptedLpAmount, bytes calldata inputProof) external returns (bool);

    /// @notice Swap tokens. Since encrypted division isn't available, the trader supplies both
    ///         `amountIn` and expected `amountOut`; the contract checks the constant-product invariant
    ///         using only multiplication/comparison, and no-ops (instead of reverting) if it fails.
    /// @param zeroForOne true for token0 -> token1, false for token1 -> token0.
    function swap(
        bool zeroForOne,
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedAmountOutDeclared,
        bytes calldata amountInProof,
        bytes calldata amountOutProof
    ) external returns (bool);
}