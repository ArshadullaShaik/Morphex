// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, euint128, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ConfidentialPair
/// @notice A constant-product AMM with encrypted reserves, LP positions, inputs,
///         outputs, and execution receipts.
/// @dev fhEVM currently exposes encrypted division only by a public scalar. This
///      pair verifies encrypted quotes and LP targets with equivalent
///      multiplication inequalities. The UI/quote component submits targets
///      encrypted; no on-chain amount is ever decrypted.
contract ConfidentialPair is ZamaEthereumConfig {
    uint16 public constant FEE_BPS = 30;
    uint16 private constant BPS = 10_000;
    uint64 private constant MINIMUM_LIQUIDITY = 1_000;
    // Keeps fee-adjusted invariant products below 2^128, the widest fhEVM
    // multiplication result available in the installed library.
    uint64 public constant MAX_RESERVE = 1_000_000_000_000_000;

    IERC7984 public immutable token0;
    IERC7984 public immutable token1;

    euint64 private _reserve0;
    euint64 private _reserve1;
    euint64 private _totalShares;
    mapping(address => euint64) private _shares;

    struct SwapReceipt {
        euint64 amountIn;
        euint64 amountOut;
        ebool success;
    }

    struct LiquidityReceipt {
        euint64 amount0;
        euint64 amount1;
        euint64 shares;
        ebool success;
    }

    mapping(address => SwapReceipt) private _lastSwap;
    mapping(address => LiquidityReceipt) private _lastLiquidity;
    bool private _locked;

    event LiquidityAdded(address indexed provider);
    event LiquidityRemoved(address indexed provider);
    event Swap(address indexed trader, bool indexed zeroForOne);

    modifier nonReentrant() {
        require(!_locked, "Morphex: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(address token0_, address token1_) {
        require(token0_ != address(0) && token1_ != address(0), "Morphex: zero token");
        require(token0_ < token1_, "Morphex: unordered pair");
        token0 = IERC7984(token0_);
        token1 = IERC7984(token1_);
    }

    function encryptedReserves() external view returns (euint64 reserve0, euint64 reserve1) {
        return (_reserve0, _reserve1);
    }

    function encryptedTotalShares() external view returns (euint64) {
        return _totalShares;
    }

    function lpBalanceOf(address provider) external view returns (euint64) {
        return _shares[provider];
    }

    function lastSwapOf(address account) external view returns (euint64 amountIn, euint64 amountOut, ebool success) {
        SwapReceipt storage receipt = _lastSwap[account];
        return (receipt.amountIn, receipt.amountOut, receipt.success);
    }

    function lastLiquidityOf(address account)
        external
        view
        returns (euint64 amount0, euint64 amount1, euint64 shares, ebool success)
    {
        LiquidityReceipt storage receipt = _lastLiquidity[account];
        return (receipt.amount0, receipt.amount1, receipt.shares, receipt.success);
    }

    /// @notice Deposits confidential amounts and mints an encrypted LP-share target.
    /// @dev The caller makes the pair a time-limited ERC-7984 operator first.
    function addLiquidity(
        externalEuint64 encryptedAmount0,
        externalEuint64 encryptedAmount1,
        externalEuint64 encryptedShareTarget,
        bytes calldata amount0Proof,
        bytes calldata amount1Proof,
        bytes calldata shareProof
    ) external nonReentrant returns (euint64 mintedShares) {
        euint64 requested0 = FHE.fromExternal(encryptedAmount0, amount0Proof);
        euint64 requested1 = FHE.fromExternal(encryptedAmount1, amount1Proof);
        euint64 shareTarget = FHE.fromExternal(encryptedShareTarget, shareProof);
        euint64 pulled0 = _pull(token0, msg.sender, requested0);
        euint64 pulled1 = _pull(token1, msg.sender, requested1);

        ebool initial = FHE.eq(_totalShares, uint64(0));
        ebool valid = FHE.select(
            initial,
            _isInitialLiquidity(pulled0, pulled1, shareTarget),
            _isProportionalLiquidity(pulled0, pulled1, shareTarget)
        );
        valid = FHE.and(
            valid,
            FHE.and(
                FHE.le(FHE.add(_reserve0, pulled0), MAX_RESERVE),
                FHE.le(FHE.add(_reserve1, pulled1), MAX_RESERVE)
            )
        );
        euint64 accepted0 = FHE.select(valid, pulled0, FHE.asEuint64(0));
        euint64 accepted1 = FHE.select(valid, pulled1, FHE.asEuint64(0));
        euint64 locked = FHE.select(FHE.and(initial, valid), FHE.asEuint64(MINIMUM_LIQUIDITY), FHE.asEuint64(0));
        mintedShares = FHE.select(initial, FHE.sub(shareTarget, locked), shareTarget);
        mintedShares = FHE.select(valid, mintedShares, FHE.asEuint64(0));

        _refund(token0, msg.sender, FHE.sub(pulled0, accepted0));
        _refund(token1, msg.sender, FHE.sub(pulled1, accepted1));
        _reserve0 = FHE.add(_reserve0, accepted0);
        _reserve1 = FHE.add(_reserve1, accepted1);
        _totalShares = FHE.add(_totalShares, FHE.add(mintedShares, locked));
        _shares[msg.sender] = FHE.add(_shares[msg.sender], mintedShares);
        _storeLiquidityReceipt(msg.sender, accepted0, accepted1, mintedShares, valid);
        _allowPoolState();
        emit LiquidityAdded(msg.sender);
    }

    /// @notice Burns encrypted LP shares for encrypted caller-selected outputs.
    /// @dev Outputs can be below the proportional maximum (a donation), but never above it.
    function removeLiquidity(
        externalEuint64 encryptedShares,
        externalEuint64 encryptedAmount0,
        externalEuint64 encryptedAmount1,
        bytes calldata sharesProof,
        bytes calldata amount0Proof,
        bytes calldata amount1Proof
    ) external nonReentrant returns (euint64 amount0, euint64 amount1) {
        euint64 requestedShares = FHE.fromExternal(encryptedShares, sharesProof);
        euint64 requested0 = FHE.fromExternal(encryptedAmount0, amount0Proof);
        euint64 requested1 = FHE.fromExternal(encryptedAmount1, amount1Proof);
        ebool valid = FHE.and(
            FHE.le(requestedShares, _shares[msg.sender]),
            FHE.and(
                FHE.le(requested0, _reserve0),
                FHE.and(FHE.le(requested1, _reserve1), _isAtMostProportional(requestedShares, requested0, requested1))
            )
        );

        euint64 burned = FHE.select(valid, requestedShares, FHE.asEuint64(0));
        amount0 = FHE.select(valid, requested0, FHE.asEuint64(0));
        amount1 = FHE.select(valid, requested1, FHE.asEuint64(0));
        euint64 delivered0 = _push(token0, msg.sender, amount0);
        euint64 delivered1 = _push(token1, msg.sender, amount1);
        _reserve0 = FHE.sub(_reserve0, delivered0);
        _reserve1 = FHE.sub(_reserve1, delivered1);
        _totalShares = FHE.sub(_totalShares, burned);
        _shares[msg.sender] = FHE.sub(_shares[msg.sender], burned);
        _storeLiquidityReceipt(msg.sender, delivered0, delivered1, burned, valid);
        _allowPoolState();
        emit LiquidityRemoved(msg.sender);
    }

    /// @notice Swaps an encrypted exact input for an encrypted output target.
    /// @dev A bad or stale target produces an encrypted no-op/refund.
    function swapExactInput(
        bool zeroForOne,
        externalEuint64 encryptedAmountIn,
        externalEuint64 encryptedAmountOut,
        bytes calldata amountInProof,
        bytes calldata amountOutProof
    ) external nonReentrant returns (euint64 amountOut) {
        euint64 requestedIn = FHE.fromExternal(encryptedAmountIn, amountInProof);
        euint64 requestedOut = FHE.fromExternal(encryptedAmountOut, amountOutProof);
        IERC7984 inputToken = zeroForOne ? token0 : token1;
        IERC7984 outputToken = zeroForOne ? token1 : token0;
        euint64 reserveIn = zeroForOne ? _reserve0 : _reserve1;
        euint64 reserveOut = zeroForOne ? _reserve1 : _reserve0;
        euint64 pulledIn = _pull(inputToken, msg.sender, requestedIn);
        ebool valid = FHE.and(
            FHE.gt(pulledIn, uint64(0)),
            FHE.and(
                FHE.le(FHE.add(reserveIn, pulledIn), MAX_RESERVE),
                FHE.and(FHE.gt(reserveIn, uint64(0)), _preservesInvariant(pulledIn, requestedOut, reserveIn, reserveOut))
            )
        );

        euint64 acceptedIn = FHE.select(valid, pulledIn, FHE.asEuint64(0));
        amountOut = FHE.select(valid, requestedOut, FHE.asEuint64(0));
        _refund(inputToken, msg.sender, FHE.sub(pulledIn, acceptedIn));
        euint64 deliveredOut = _push(outputToken, msg.sender, amountOut);
        if (zeroForOne) {
            _reserve0 = FHE.add(_reserve0, acceptedIn);
            _reserve1 = FHE.sub(_reserve1, deliveredOut);
        } else {
            _reserve1 = FHE.add(_reserve1, acceptedIn);
            _reserve0 = FHE.sub(_reserve0, deliveredOut);
        }
        _storeSwapReceipt(msg.sender, acceptedIn, deliveredOut, valid);
        _allowPoolState();
        emit Swap(msg.sender, zeroForOne);
        return deliveredOut;
    }

    function _isInitialLiquidity(euint64 amount0, euint64 amount1, euint64 shareTarget) private returns (ebool) {
        euint128 product = FHE.mul(FHE.asEuint128(amount0), FHE.asEuint128(amount1));
        euint128 square = FHE.mul(FHE.asEuint128(shareTarget), FHE.asEuint128(shareTarget));
        euint64 nextShare = FHE.add(shareTarget, uint64(1));
        euint128 nextSquare = FHE.mul(FHE.asEuint128(nextShare), FHE.asEuint128(nextShare));
        return FHE.and(
            FHE.gt(shareTarget, MINIMUM_LIQUIDITY),
            FHE.and(FHE.le(square, product), FHE.gt(nextSquare, product))
        );
    }

    function _isProportionalLiquidity(euint64 amount0, euint64 amount1, euint64 shares) private returns (ebool) {
        euint128 amount0Scaled = FHE.mul(FHE.asEuint128(amount0), FHE.asEuint128(_totalShares));
        euint128 amount1Scaled = FHE.mul(FHE.asEuint128(amount1), FHE.asEuint128(_totalShares));
        euint128 shares0 = FHE.mul(FHE.asEuint128(shares), FHE.asEuint128(_reserve0));
        euint128 shares1 = FHE.mul(FHE.asEuint128(shares), FHE.asEuint128(_reserve1));
        return FHE.and(
            FHE.gt(shares, uint64(0)),
            FHE.and(FHE.eq(amount0Scaled, shares0), FHE.eq(amount1Scaled, shares1))
        );
    }

    function _isAtMostProportional(euint64 shares, euint64 amount0, euint64 amount1) private returns (ebool) {
        euint128 amount0Scaled = FHE.mul(FHE.asEuint128(amount0), FHE.asEuint128(_totalShares));
        euint128 amount1Scaled = FHE.mul(FHE.asEuint128(amount1), FHE.asEuint128(_totalShares));
        euint128 shares0 = FHE.mul(FHE.asEuint128(shares), FHE.asEuint128(_reserve0));
        euint128 shares1 = FHE.mul(FHE.asEuint128(shares), FHE.asEuint128(_reserve1));
        return FHE.and(FHE.le(amount0Scaled, shares0), FHE.le(amount1Scaled, shares1));
    }

    function _preservesInvariant(euint64 amountIn, euint64 amountOut, euint64 reserveIn, euint64 reserveOut)
        private
        returns (ebool)
    {
        ebool hasOutput = FHE.le(amountOut, reserveOut);
        euint64 safeOut = FHE.select(hasOutput, amountOut, FHE.asEuint64(0));
        euint128 adjustedInputReserve = FHE.add(
            FHE.mul(FHE.asEuint128(reserveIn), uint128(BPS)),
            FHE.mul(FHE.asEuint128(amountIn), uint128(BPS - FEE_BPS))
        );
        euint128 left = FHE.mul(adjustedInputReserve, FHE.asEuint128(FHE.sub(reserveOut, safeOut)));
        euint128 invariant = FHE.mul(FHE.asEuint128(reserveIn), FHE.asEuint128(reserveOut));
        euint128 right = FHE.mul(invariant, uint128(BPS));
        return FHE.and(hasOutput, FHE.ge(left, right));
    }

    function _pull(IERC7984 token, address from, euint64 amount) private returns (euint64) {
        FHE.allowTransient(amount, address(token));
        return token.confidentialTransferFrom(from, address(this), amount);
    }

    function _push(IERC7984 token, address to, euint64 amount) private returns (euint64) {
        FHE.allowTransient(amount, address(token));
        return token.confidentialTransfer(to, amount);
    }

    function _refund(IERC7984 token, address to, euint64 amount) private {
        _push(token, to, amount);
    }

    function _storeSwapReceipt(address account, euint64 amountIn, euint64 amountOut, ebool success) private {
        _lastSwap[account] = SwapReceipt(amountIn, amountOut, success);
        FHE.allowThis(amountIn); FHE.allowThis(amountOut); FHE.allowThis(success);
        FHE.allow(amountIn, account); FHE.allow(amountOut, account); FHE.allow(success, account);
    }

    function _storeLiquidityReceipt(address account, euint64 amount0, euint64 amount1, euint64 shares, ebool success)
        private
    {
        _lastLiquidity[account] = LiquidityReceipt(amount0, amount1, shares, success);
        FHE.allowThis(amount0); FHE.allowThis(amount1); FHE.allowThis(shares); FHE.allowThis(success);
        FHE.allow(amount0, account); FHE.allow(amount1, account); FHE.allow(shares, account); FHE.allow(success, account);
    }

    function _allowPoolState() private {
        FHE.allowThis(_reserve0); FHE.allowThis(_reserve1); FHE.allowThis(_totalShares);
        FHE.allowThis(_shares[msg.sender]); FHE.allow(_shares[msg.sender], msg.sender);
    }
}
