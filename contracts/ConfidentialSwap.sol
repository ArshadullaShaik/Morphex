// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IConfidentialSwap} from "./interfaces/IConfidentialSwap.sol";
import {IConfidentialToken} from "./interfaces/IConfidentialToken.sol";

/// @title ConfidentialSwap
/// @notice Constant-product (x*y=k) AMM for two ConfidentialTokens. Reserves, LP shares, and trade
///         sizes are encrypted; only the pool address and token pair are public.
///
/// @dev No encrypted division exists, so `amountOut` can't be derived on-chain from `amountIn`.
///      Instead the trader computes both off-chain (from reserves they can decrypt) and submits both
///      as encrypted inputs. The contract verifies using only multiplication/comparison:
///
///          reserve0' = reserve0 + amountIn        (zeroForOne)
///          reserve1' = reserve1 - amountOut
///          require  reserve0' * reserve1' >= reserve0 * reserve1
///
///      Products are widened to euint128 to avoid overflow. Failed checks clamp to a zero-amount
///      no-op via `FHE.select` rather than reverting, so failure reasons aren't leaked.
contract ConfidentialSwap is IConfidentialSwap, ZamaEthereumConfig {
    IConfidentialToken public immutable token0;
    IConfidentialToken public immutable token1;

    euint64 private _reserve0;
    euint64 private _reserve1;
    bool private _reservesInitialized;

    euint64 private _totalLpShares;
    bool private _totalLpInitialized;

    mapping(address => euint64) private _lpBalances;
    mapping(address => bool) private _lpInitialized;

    /// @dev Cheap reentrancy guard around the external token calls.
    bool private _locked;

    modifier nonReentrant() {
        require(!_locked, "ConfidentialSwap: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address token0_, address token1_) {
        require(token0_ != address(0) && token1_ != address(0), "ConfidentialSwap: zero token address");
        require(token0_ != token1_, "ConfidentialSwap: identical tokens");
        token0 = IConfidentialToken(token0_);
        token1 = IConfidentialToken(token1_);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function encryptedReserves() external view override returns (euint64, euint64) {
        return (_reserves0(), _reserves1());
    }

    function lpBalanceOf(address provider) external view override returns (euint64) {
        if (!_lpInitialized[provider]) return euint64.wrap(0);
        return _lpBalances[provider];
    }

    function _reserves0() private view returns (euint64) {
        return _reservesInitialized ? _reserve0 : euint64.wrap(0);
    }

    function _reserves1() private view returns (euint64) {
        return _reservesInitialized ? _reserve1 : euint64.wrap(0);
    }

    function _totalLp() private view returns (euint64) {
        return _totalLpInitialized ? _totalLpShares : euint64.wrap(0);
    }

    // ------------------------------------------------------------------
    // Liquidity
    // ------------------------------------------------------------------

    /// @notice Add liquidity. First deposit mints LP shares equal to `amount0` (sqrt(x*y) minting is
    ///         skipped since sqrt isn't available on encrypted types either — a deliberate
    ///         simplification, not a bug). The contract doesn't enforce deposit ratio on-chain (needs
    ///         division); LPs are trusted not to unbalance the pool on deposit. Only swaps are fully
    ///         invariant-checked.
    function addLiquidity(
        externalEuint64 encryptedAmount0,
        externalEuint64 encryptedAmount1,
        bytes calldata amount0Proof,
        bytes calldata amount1Proof
    ) external override nonReentrant returns (bool) {
        euint64 amount0 = FHE.fromExternal(encryptedAmount0, amount0Proof);
        euint64 amount1 = FHE.fromExternal(encryptedAmount1, amount1Proof);

        // Pull tokens in via the handle-based composability hook.
        FHE.allowTransient(amount0, address(token0));
        FHE.allowTransient(amount1, address(token1));
        euint64 moved0 = token0.transferFromHandle(address(this), msg.sender, address(this), amount0);
        euint64 moved1 = token1.transferFromHandle(address(this), msg.sender, address(this), amount1);

        euint64 newReserve0 = FHE.add(_reserves0(), moved0);
        euint64 newReserve1 = FHE.add(_reserves1(), moved1);
        _setReserves(newReserve0, newReserve1);

        // LP shares minted = amount0 moved (see NatSpec above).
        euint64 newLpShare = FHE.add(_lpBalanceOf(msg.sender), moved0);
        _setLpBalance(msg.sender, newLpShare);
        _setTotalLp(FHE.add(_totalLp(), moved0));

        emit LiquidityAdded(msg.sender);
        return true;
    }

    /// @notice Remove liquidity. Payout math would need division, which isn't available, so this
    ///         burns LP shares 1:1 against token0. Clamps to caller's LP balance and available
    ///         reserve0; always succeeds (never reverts) on shortfall.
    function removeLiquidity(
        externalEuint64 encryptedLpAmount,
        bytes calldata inputProof
    ) external override nonReentrant returns (bool) {
        euint64 requested = FHE.fromExternal(encryptedLpAmount, inputProof);
        euint64 lpBalance = _lpBalanceOf(msg.sender);
        euint64 reserve0 = _reserves0();

        ebool hasEnoughShares = FHE.le(requested, lpBalance);
        ebool poolHasEnough = FHE.le(requested, reserve0);
        ebool ok = FHE.and(hasEnoughShares, poolHasEnough);

        euint64 burnAmount = FHE.select(ok, requested, FHE.asEuint64(0));

        _setLpBalance(msg.sender, FHE.sub(lpBalance, burnAmount));
        _setTotalLp(FHE.sub(_totalLp(), burnAmount));
        _setReserves(FHE.sub(reserve0, burnAmount), _reserves1());

        FHE.allowTransient(burnAmount, address(token0));
        token0.transferHandle(address(this), msg.sender, burnAmount);

        emit LiquidityRemoved(msg.sender);
        return true;
    }

    // ------------------------------------------------------------------
    // Swap
    // ------------------------------------------------------------------

    function swap(
        bool zeroForOne,
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedAmountOutDeclared,
        bytes calldata amountInProof,
        bytes calldata amountOutProof
    ) external override nonReentrant returns (bool) {
        euint64 amountIn = FHE.fromExternal(encryptedAmountIn, amountInProof);
        euint64 amountOutDeclared = FHE.fromExternal(encryptedAmountOutDeclared, amountOutProof);

        euint64 reserveIn = zeroForOne ? _reserves0() : _reserves1();
        euint64 reserveOut = zeroForOne ? _reserves1() : _reserves0();

        // amountOut can't exceed the reserve it's drawn from.
        ebool outWithinReserve = FHE.le(amountOutDeclared, reserveOut);

        // Constant-product check: k must not decrease. Done in euint128 to avoid overflow.
        euint64 outClampedForMath = FHE.select(outWithinReserve, amountOutDeclared, FHE.asEuint64(0));

        euint128 newReserveIn128 = FHE.asEuint128(FHE.add(reserveIn, amountIn));
        euint128 newReserveOut128 = FHE.asEuint128(FHE.sub(reserveOut, outClampedForMath));
        euint128 kAfter = FHE.mul(newReserveIn128, newReserveOut128);

        euint128 reserveIn128 = FHE.asEuint128(reserveIn);
        euint128 reserveOut128 = FHE.asEuint128(reserveOut);
        euint128 kBefore = FHE.mul(reserveIn128, reserveOut128);

        ebool invariantHolds = FHE.ge(kAfter, kBefore);
        ebool tradeOk = FHE.and(outWithinReserve, invariantHolds);

        euint64 finalAmountIn = FHE.select(tradeOk, amountIn, FHE.asEuint64(0));
        euint64 finalAmountOut = FHE.select(tradeOk, amountOutDeclared, FHE.asEuint64(0));

        // Move tokens via composability hooks — avoids needing a second proof bound to this contract.
        FHE.allowTransient(finalAmountIn, zeroForOne ? address(token0) : address(token1));
        FHE.allowTransient(finalAmountOut, zeroForOne ? address(token1) : address(token0));

        if (zeroForOne) {
            token0.transferFromHandle(address(this), msg.sender, address(this), finalAmountIn);
            token1.transferHandle(address(this), msg.sender, finalAmountOut);
            _setReserves(FHE.add(_reserves0(), finalAmountIn), FHE.sub(_reserves1(), finalAmountOut));
        } else {
            token1.transferFromHandle(address(this), msg.sender, address(this), finalAmountIn);
            token0.transferHandle(address(this), msg.sender, finalAmountOut);
            _setReserves(FHE.sub(_reserves0(), finalAmountOut), FHE.add(_reserves1(), finalAmountIn));
        }

        emit Swap(msg.sender, zeroForOne);
        return true;
    }

    // ------------------------------------------------------------------
    // Internal state setters (centralize ACL grants)
    // ------------------------------------------------------------------

    function _lpBalanceOf(address provider) private view returns (euint64) {
        return _lpInitialized[provider] ? _lpBalances[provider] : euint64.wrap(0);
    }

    function _setReserves(euint64 newReserve0, euint64 newReserve1) private {
        _reserve0 = newReserve0;
        _reserve1 = newReserve1;
        _reservesInitialized = true;
        FHE.allowThis(newReserve0);
        FHE.allowThis(newReserve1);
    }

    function _setLpBalance(address provider, euint64 newBalance) private {
        _lpBalances[provider] = newBalance;
        _lpInitialized[provider] = true;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, provider);
    }

    function _setTotalLp(euint64 newTotal) private {
        _totalLpShares = newTotal;
        _totalLpInitialized = true;
        FHE.allowThis(newTotal);
    }
}