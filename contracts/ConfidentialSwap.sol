// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialToken} from "./ConfidentialToken.sol";

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

    function addLiquidity(
        externalEuint64 encryptedAmount0,
        externalEuint64 encryptedAmount1,
        bytes calldata amount0Proof,
        bytes calldata amount1Proof
    ) external nonReentrant returns (bool) {
        euint64 amount0 = FHE.fromExternal(encryptedAmount0, amount0Proof);
        euint64 amount1 = FHE.fromExternal(encryptedAmount1, amount1Proof);

        FHE.allowTransient(amount0, address(token0));
        FHE.allowTransient(amount1, address(token1));
        euint64 moved0 = token0.transferFromHandle(address(this), msg.sender, address(this), amount0);
        euint64 moved1 = token1.transferFromHandle(address(this), msg.sender, address(this), amount1);

        euint64 newReserve0 = FHE.add(_reserves0(), moved0);
        euint64 newReserve1 = FHE.add(_reserves1(), moved1);
        _setReserves(newReserve0, newReserve1);

        euint64 newLpShare = FHE.add(_lpBalanceOf(msg.sender), moved0);
        _setLpBalance(msg.sender, newLpShare);
        _setTotalLp(FHE.add(_totalLp(), moved0));

        emit LiquidityAdded(msg.sender);
        return true;
    }

    function removeLiquidity(
        externalEuint64 encryptedLpAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (bool) {
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

    function _checkSwap(
        bool zeroForOne,
        euint64 amountIn,
        euint64 amountOutDeclared
    ) private returns (ebool) {
        euint64 rIn = zeroForOne ? _reserves0() : _reserves1();
        euint64 rOut = zeroForOne ? _reserves1() : _reserves0();

        return FHE.and(
            FHE.le(amountOutDeclared, rOut),
            FHE.ge(
                FHE.mul(
                    FHE.asEuint128(FHE.add(rIn, amountIn)),
                    FHE.asEuint128(FHE.sub(rOut, FHE.select(FHE.le(amountOutDeclared, rOut), amountOutDeclared, FHE.asEuint64(0))))
                ),
                FHE.mul(FHE.asEuint128(rIn), FHE.asEuint128(rOut))
            )
        );
    }

    function swap(
        bool zeroForOne,
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedAmountOutDeclared,
        bytes calldata amountInProof,
        bytes calldata amountOutProof
    ) external nonReentrant returns (bool) {
        euint64 amountIn = FHE.fromExternal(encryptedAmountIn, amountInProof);
        euint64 amountOutDeclared = FHE.fromExternal(encryptedAmountOutDeclared, amountOutProof);

        ebool tradeOk = _checkSwap(zeroForOne, amountIn, amountOutDeclared);

        euint64 finalAmountIn = FHE.select(tradeOk, amountIn, FHE.asEuint64(0));
        euint64 finalAmountOut = FHE.select(tradeOk, amountOutDeclared, FHE.asEuint64(0));

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