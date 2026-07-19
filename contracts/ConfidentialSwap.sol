// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialToken} from "./ConfidentialToken.sol";

/// @notice Constant-product (x*y=k) pool for two ConfidentialToken instances.
/// Reserves, LP shares, and trade amounts are encrypted. No fee is charged.
/// No encrypted/encrypted division is used anywhere (fhEVM doesn't support it) —
/// every proportionality check is done by cross-multiplying and comparing,
/// same technique for swaps, liquidity minting, and liquidity burning.
contract ConfidentialSwap is ZamaEthereumConfig {
    event LiquidityAdded(address indexed provider);
    event LiquidityRemoved(address indexed provider);
    event Swap(address indexed trader, bool indexed zeroForOne);

    ConfidentialToken public immutable token0;
    ConfidentialToken public immutable token1;

    euint64 private _reserve0;
    euint64 private _reserve1;
    bool private _reservesInitialized;

    euint64 private _totalLpShares;
    bool private _totalLpInitialized;

    mapping(address => euint64) private _lpBalances;
    mapping(address => bool) private _lpInitialized;

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
        token0 = ConfidentialToken(token0_);
        token1 = ConfidentialToken(token1_);
    }

    function encryptedReserves() external view returns (euint64, euint64) {
        return (_reserves0(), _reserves1());
    }

    function lpBalanceOf(address provider) external view returns (euint64) {
        return _lpBalanceOf(provider);
    }

    function totalLpShares() external view returns (euint64) {
        return _totalLp();
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

    function _lpBalanceOf(address provider) private view returns (euint64) {
        return _lpInitialized[provider] ? _lpBalances[provider] : euint64.wrap(0);
    }

    /// @param encryptedSharesDeclared The LP-share amount the caller expects to
    /// receive, computed off-chain. Ignored on the very first deposit (which
    /// bootstraps the share unit 1:1 with token0); on every deposit after that
    /// it is verified — never trusted — against the real pool state.
    function addLiquidity(
        externalEuint64 encryptedAmount0,
        externalEuint64 encryptedAmount1,
        externalEuint64 encryptedSharesDeclared,
        bytes calldata amount0Proof,
        bytes calldata amount1Proof,
        bytes calldata sharesProof
    ) external nonReentrant returns (bool) {
        euint64 amount0 = FHE.fromExternal(encryptedAmount0, amount0Proof);
        euint64 amount1 = FHE.fromExternal(encryptedAmount1, amount1Proof);
        euint64 sharesDeclared = FHE.fromExternal(encryptedSharesDeclared, sharesProof);

        euint64 reserve0 = _reserves0();
        euint64 reserve1 = _reserves1();
        euint64 totalLp = _totalLp();
        bool isBootstrap = !_totalLpInitialized;

        // Pull tokens first. ConfidentialToken.transferFromHandle clamps
        // all-or-nothing to the caller's real balance/allowance, so `moved0`
        // / `moved1` are always genuine. Shares are computed from these, never
        // from the caller's unverified declared amounts — otherwise a caller
        // could declare amounts they don't actually hold and still be minted
        // shares backed by nothing.
        FHE.allowTransient(amount0, address(token0));
        FHE.allowTransient(amount1, address(token1));
        euint64 moved0 = token0.transferFromHandle(address(this), msg.sender, address(this), amount0);
        euint64 moved1 = token1.transferFromHandle(address(this), msg.sender, address(this), amount1);

        euint64 sharesToMint;
        ebool ok;

        if (isBootstrap) {
            sharesToMint = moved0;
            ok = FHE.gt(moved0, 0);
        } else {
            // Declared shares must not exceed the fair proportional value of
            // EITHER asset actually deposited: sharesDeclared <= totalLp * moved0 / reserve0
            // and sharesDeclared <= totalLp * moved1 / reserve1, rewritten without
            // division by cross-multiplying. Rounds in the pool's favor.
            ebool shareOk0 = FHE.le(
                FHE.mul(FHE.asEuint128(sharesDeclared), FHE.asEuint128(reserve0)),
                FHE.mul(FHE.asEuint128(totalLp), FHE.asEuint128(moved0))
            );
            ebool shareOk1 = FHE.le(
                FHE.mul(FHE.asEuint128(sharesDeclared), FHE.asEuint128(reserve1)),
                FHE.mul(FHE.asEuint128(totalLp), FHE.asEuint128(moved1))
            );
            sharesToMint = sharesDeclared;
            ok = FHE.and(FHE.and(shareOk0, shareOk1), FHE.gt(sharesDeclared, 0));
        }

        euint64 finalShares = FHE.select(ok, sharesToMint, FHE.asEuint64(0));

        // Reserves always absorb whatever genuinely moved in. If the declared
        // shares were invalid, the caller simply donates to the pool instead
        // of minting shares (a self-inflicted loss for a bad declaration, not
        // an exploit — existing LPs' shares only become worth more).
        _setReserves(FHE.add(reserve0, moved0), FHE.add(reserve1, moved1));
        _setLpBalance(msg.sender, FHE.add(_lpBalanceOf(msg.sender), finalShares));
        _setTotalLp(FHE.add(totalLp, finalShares));

        emit LiquidityAdded(msg.sender);
        return true;
    }

    /// @param encryptedAmount0Out / encryptedAmount1Out The amounts of each
    /// token the caller expects back for the shares they're burning, computed
    /// off-chain. Verified against the real pool state via cross-multiplication,
    /// never trusted outright.
    function removeLiquidity(
        externalEuint64 encryptedLpAmount,
        externalEuint64 encryptedAmount0Out,
        externalEuint64 encryptedAmount1Out,
        bytes calldata lpProof,
        bytes calldata amount0OutProof,
        bytes calldata amount1OutProof
    ) external nonReentrant returns (bool) {
        euint64 lpAmount = FHE.fromExternal(encryptedLpAmount, lpProof);
        euint64 amount0Out = FHE.fromExternal(encryptedAmount0Out, amount0OutProof);
        euint64 amount1Out = FHE.fromExternal(encryptedAmount1Out, amount1OutProof);

        euint64 lpBalance = _lpBalanceOf(msg.sender);
        euint64 reserve0 = _reserves0();
        euint64 reserve1 = _reserves1();
        euint64 totalLp = _totalLp();

        ebool hasEnoughShares = FHE.le(lpAmount, lpBalance);

        // amountOut <= lpAmount * reserve / totalLp, cross-multiplied to avoid
        // division. Both tokens are checked, so a burn always redeems a
        // proportional slice of BOTH reserves, never just one.
        ebool amount0Ok = FHE.le(
            FHE.mul(FHE.asEuint128(amount0Out), FHE.asEuint128(totalLp)),
            FHE.mul(FHE.asEuint128(lpAmount), FHE.asEuint128(reserve0))
        );
        ebool amount1Ok = FHE.le(
            FHE.mul(FHE.asEuint128(amount1Out), FHE.asEuint128(totalLp)),
            FHE.mul(FHE.asEuint128(lpAmount), FHE.asEuint128(reserve1))
        );

        ebool ok = FHE.and(hasEnoughShares, FHE.and(amount0Ok, amount1Ok));

        euint64 burnShares = FHE.select(ok, lpAmount, FHE.asEuint64(0));
        euint64 out0 = FHE.select(ok, amount0Out, FHE.asEuint64(0));
        euint64 out1 = FHE.select(ok, amount1Out, FHE.asEuint64(0));

        _setLpBalance(msg.sender, FHE.sub(lpBalance, burnShares));
        _setTotalLp(FHE.sub(totalLp, burnShares));
        _setReserves(FHE.sub(reserve0, out0), FHE.sub(reserve1, out1));

        FHE.allowTransient(out0, address(token0));
        FHE.allowTransient(out1, address(token1));
        token0.transferHandle(address(this), msg.sender, out0);
        token1.transferHandle(address(this), msg.sender, out1);

        emit LiquidityRemoved(msg.sender);
        return true;
    }

    /// @param encryptedAmountOutDeclared The output amount the trader expects,
    /// computed off-chain against the current encrypted reserves. Verified via
    /// the constant-product invariant below, never trusted outright.
    function swap(
        bool zeroForOne,
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedAmountOutDeclared,
        bytes calldata amountInProof,
        bytes calldata amountOutProof
    ) external nonReentrant returns (bool) {
        euint64 amountIn = FHE.fromExternal(encryptedAmountIn, amountInProof);
        euint64 amountOutDeclared = FHE.fromExternal(encryptedAmountOutDeclared, amountOutProof);

        ConfidentialToken tokenIn = zeroForOne ? token0 : token1;
        ConfidentialToken tokenOut = zeroForOne ? token1 : token0;

        // Pull the input FIRST and use the amount that actually moved for the
        // invariant check and the payout below — never the trader's declared
        // amountIn. Otherwise a trader could declare an amountIn they don't
        // have; transferFromHandle would clamp the real transfer to zero, but
        // a payout still computed from the declared amount would drain the
        // other side of the pool for free.
        FHE.allowTransient(amountIn, address(tokenIn));
        euint64 movedIn = tokenIn.transferFromHandle(address(this), msg.sender, address(this), amountIn);

        ebool tradeOk = _checkSwap(zeroForOne, movedIn, amountOutDeclared);
        euint64 finalAmountOut = FHE.select(tradeOk, amountOutDeclared, FHE.asEuint64(0));

        if (zeroForOne) {
            _setReserves(FHE.add(_reserves0(), movedIn), FHE.sub(_reserves1(), finalAmountOut));
        } else {
            _setReserves(FHE.sub(_reserves0(), finalAmountOut), FHE.add(_reserves1(), movedIn));
        }

        FHE.allowTransient(finalAmountOut, address(tokenOut));
        tokenOut.transferHandle(address(this), msg.sender, finalAmountOut);

        emit Swap(msg.sender, zeroForOne);
        return true;
    }

    // Constant-product check: (rIn + amountIn) * (rOut - amountOut) >= rIn * rOut.
    // Cross-multiplied in euint128 to avoid overflow and avoid division entirely.
    function _checkSwap(bool zeroForOne, euint64 amountIn, euint64 amountOutDeclared) private returns (ebool) {
        euint64 rIn = zeroForOne ? _reserves0() : _reserves1();
        euint64 rOut = zeroForOne ? _reserves1() : _reserves0();

        ebool withinReserve = FHE.le(amountOutDeclared, rOut);
        // Clamp before subtracting so a too-large declared amount can't
        // underflow rOut - amountOut; withinReserve still gates the final result.
        euint64 safeAmountOut = FHE.select(withinReserve, amountOutDeclared, FHE.asEuint64(0));

        euint128 kBefore = FHE.mul(FHE.asEuint128(rIn), FHE.asEuint128(rOut));
        euint128 kAfter = FHE.mul(FHE.asEuint128(FHE.add(rIn, amountIn)), FHE.asEuint128(FHE.sub(rOut, safeAmountOut)));

        return FHE.and(withinReserve, FHE.ge(kAfter, kBefore));
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