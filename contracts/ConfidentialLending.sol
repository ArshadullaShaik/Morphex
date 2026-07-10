// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IConfidentialLending} from "./interfaces/IConfidentialLending.sol";
import {IConfidentialToken} from "./interfaces/IConfidentialToken.sol";

/// @title ConfidentialLending
/// @notice Single collateral asset / single debt asset lending pool with encrypted positions.
///
/// @dev Design notes:
///      - Prices are plaintext/public (an oracle price is already public info); only each account's
///        collateral and debt amounts are encrypted.
///      - No encrypted/encrypted division, so the health check is cross-multiplied instead of divided:
///
///            collateral * collateralPrice * 10_000  >=  debt * debtPrice * collateralRatioBps
///
///      - Borrow/withdraw/liquidate all clamp to a no-op via `FHE.select` on failure instead of
///        reverting, so tx success/failure never reveals how close an account is to its limit —
///        bots can't scan for liquidatable accounts, only try and silently fail.
///      - Deliberately minimal: single pair, no interest accrual, to keep the encrypted math small
///        and auditable. Interest can be layered on later with the same multiplication-only approach.
contract ConfidentialLending is IConfidentialLending, ZamaEthereumConfig {
    IConfidentialToken public immutable collateralToken;
    IConfidentialToken public immutable debtToken;

    /// @dev Plaintext oracle prices, scaled by 1e6. Owner-settable for now; swap for a real feed
    ///      (with staleness checks) in production.
    uint64 public collateralPrice = 1e6;
    uint64 public debtPrice = 1e6;

    /// @notice Minimum collateralization ratio, in basis points (15000 = 150%).
    uint16 public constant COLLATERAL_RATIO_BPS = 15000;
    uint16 private constant BPS_DENOMINATOR = 10000;

    address public owner;

    mapping(address => euint64) private _collateral;
    mapping(address => bool) private _collateralInitialized;

    mapping(address => euint64) private _debt;
    mapping(address => bool) private _debtInitialized;

    modifier onlyOwner() {
        require(msg.sender == owner, "ConfidentialLending: not owner");
        _;
    }

    constructor(address collateralToken_, address debtToken_) {
        require(collateralToken_ != address(0) && debtToken_ != address(0), "ConfidentialLending: zero address");
        collateralToken = IConfidentialToken(collateralToken_);
        debtToken = IConfidentialToken(debtToken_);
        owner = msg.sender;
    }

    // ------------------------------------------------------------------
    // Admin (testnet convenience — replace with a real oracle in production)
    // ------------------------------------------------------------------

    function setPrices(uint64 newCollateralPrice, uint64 newDebtPrice) external onlyOwner {
        require(newCollateralPrice > 0 && newDebtPrice > 0, "ConfidentialLending: zero price");
        collateralPrice = newCollateralPrice;
        debtPrice = newDebtPrice;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function collateralBalanceOf(address account) public view override returns (euint64) {
        return _collateralInitialized[account] ? _collateral[account] : euint64.wrap(0);
    }

    function debtBalanceOf(address account) public view override returns (euint64) {
        return _debtInitialized[account] ? _debt[account] : euint64.wrap(0);
    }

    // ------------------------------------------------------------------
    // Collateral
    // ------------------------------------------------------------------

    function depositCollateral(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        FHE.allowTransient(amount, address(collateralToken));
        euint64 moved = collateralToken.transferFromHandle(address(this), msg.sender, address(this), amount);

        _setCollateral(msg.sender, FHE.add(collateralBalanceOf(msg.sender), moved));
        emit CollateralDeposited(msg.sender);
        return true;
    }

    /// @notice Withdraw collateral, clamped so the position stays healthy and never exceeds the
    ///         account's balance. Silently no-ops (moves zero) on either failure.
    function withdrawCollateral(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 currentCollateral = collateralBalanceOf(msg.sender);
        euint64 currentDebt = debtBalanceOf(msg.sender);

        ebool hasEnough = FHE.le(requested, currentCollateral);
        euint64 collateralAfter = FHE.select(hasEnough, FHE.sub(currentCollateral, requested), currentCollateral);

        ebool remainsHealthy = _isHealthy(collateralAfter, currentDebt);
        ebool ok = FHE.and(hasEnough, remainsHealthy);

        euint64 withdrawAmount = FHE.select(ok, requested, FHE.asEuint64(0));
        _setCollateral(msg.sender, FHE.sub(currentCollateral, withdrawAmount));

        FHE.allowTransient(withdrawAmount, address(collateralToken));
        collateralToken.transferHandle(address(this), msg.sender, withdrawAmount);

        emit CollateralWithdrawn(msg.sender);
        return true;
    }

    // ------------------------------------------------------------------
    // Borrow / Repay
    // ------------------------------------------------------------------

    /// @notice Borrow against posted collateral. Clamps to zero if it would breach
    ///         `COLLATERAL_RATIO_BPS`, or if the pool lacks liquidity.
    function borrow(externalEuint64 encryptedAmount, bytes calldata inputProof) external override returns (bool) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 currentCollateral = collateralBalanceOf(msg.sender);
        euint64 currentDebt = debtBalanceOf(msg.sender);

        euint64 debtAfter = FHE.add(currentDebt, requested);
        ebool wouldBeHealthy = _isHealthy(currentCollateral, debtAfter);

        euint64 poolLiquidity = debtToken.confidentialBalanceOf(address(this));
        ebool poolHasLiquidity = FHE.le(requested, poolLiquidity);

        ebool ok = FHE.and(wouldBeHealthy, poolHasLiquidity);
        euint64 borrowAmount = FHE.select(ok, requested, FHE.asEuint64(0));

        _setDebt(msg.sender, FHE.add(currentDebt, borrowAmount));

        FHE.allowTransient(borrowAmount, address(debtToken));
        debtToken.transferHandle(address(this), msg.sender, borrowAmount);

        emit Borrowed(msg.sender);
        return true;
    }

    function repay(externalEuint64 encryptedAmount, bytes calldata inputProof) external override returns (bool) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 currentDebt = debtBalanceOf(msg.sender);

        // Clamp to outstanding debt so debt can't go negative.
        ebool withinDebt = FHE.le(requested, currentDebt);
        euint64 repayAmount = FHE.select(withinDebt, requested, currentDebt);

        FHE.allowTransient(repayAmount, address(debtToken));
        euint64 moved = debtToken.transferFromHandle(address(this), msg.sender, address(this), repayAmount);

        _setDebt(msg.sender, FHE.sub(currentDebt, moved));
        emit Repaid(msg.sender);
        return true;
    }

    // ------------------------------------------------------------------
    // Liquidation
    // ------------------------------------------------------------------

    /// @notice Anyone can attempt to liquidate anyone. Tokens only actually move if `account` is
    ///         genuinely undercollateralized; otherwise everything clamps to zero and the call
    ///         reveals nothing about `account`'s real position.
    function liquidate(
        address account,
        externalEuint64 encryptedRepayAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        euint64 requestedRepay = FHE.fromExternal(encryptedRepayAmount, inputProof);

        euint64 accountCollateral = collateralBalanceOf(account);
        euint64 accountDebt = debtBalanceOf(account);

        ebool isUndercollateralized = FHE.not(_isHealthy(accountCollateral, accountDebt));
        ebool repayWithinDebt = FHE.le(requestedRepay, accountDebt);
        ebool ok = FHE.and(isUndercollateralized, repayWithinDebt);

        euint64 repayAmount = FHE.select(ok, requestedRepay, FHE.asEuint64(0));

        // Dividing by a plaintext scalar (the public oracle price) is fine — only
        // encrypted-by-encrypted division is unavailable.
        euint128 repayValue128 = FHE.mul(FHE.asEuint128(repayAmount), uint128(debtPrice));
        euint64 seizeAmount = FHE.asEuint64(FHE.div(repayValue128, uint128(collateralPrice)));
        seizeAmount = FHE.select(FHE.le(seizeAmount, accountCollateral), seizeAmount, accountCollateral);
        seizeAmount = FHE.select(ok, seizeAmount, FHE.asEuint64(0));

        FHE.allowTransient(repayAmount, address(debtToken));
        euint64 movedRepay = debtToken.transferFromHandle(address(this), msg.sender, address(this), repayAmount);

        _setDebt(account, FHE.sub(accountDebt, movedRepay));
        _setCollateral(account, FHE.sub(accountCollateral, seizeAmount));

        FHE.allowTransient(seizeAmount, address(collateralToken));
        collateralToken.transferHandle(address(this), msg.sender, seizeAmount);

        emit LiquidationAttempted(account, msg.sender);
        return true;
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /// @dev collateral * collateralPrice * BPS_DENOMINATOR >= debt * debtPrice * COLLATERAL_RATIO_BPS
    ///      Cross-multiplied to avoid division; widened to euint128 to avoid overflow.
    function _isHealthy(euint64 collateralAmount, euint64 debtAmount) private returns (ebool) {
        euint128 collateralValue = FHE.mul(
            FHE.asEuint128(collateralAmount),
            uint128(uint256(collateralPrice) * BPS_DENOMINATOR)
        );
        euint128 debtValue = FHE.mul(FHE.asEuint128(debtAmount), uint128(uint256(debtPrice) * COLLATERAL_RATIO_BPS));
        return FHE.ge(collateralValue, debtValue);
    }

    function _setCollateral(address account, euint64 newBalance) private {
        _collateral[account] = newBalance;
        _collateralInitialized[account] = true;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, account);
    }

    function _setDebt(address account, euint64 newBalance) private {
        _debt[account] = newBalance;
        _debtInitialized[account] = true;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, account);
    }
}