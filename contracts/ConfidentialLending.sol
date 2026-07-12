// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IConfidentialLending} from "./interfaces/IConfidentialLending.sol";
import {IConfidentialToken} from "./interfaces/IConfidentialToken.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title ConfidentialLending
/// @notice Single collateral / single debt asset lending pool with encrypted positions.
/// @dev No encrypted/encrypted division - health check is cross-multiplied instead of ratio'd:
///      collateral * price * 10_000 >= debt * price * collateralRatioBps.
///      All failure paths clamp to a no-op via FHE.select instead of reverting, so a failed
///      borrow/withdraw/liquidation leaks nothing about the account's real position.
contract ConfidentialLending is IConfidentialLending, ZamaEthereumConfig {
    IConfidentialToken public immutable collateralToken;
    IConfidentialToken public immutable debtToken;

    // ------------------------------------------------------------------
    // Pricing - pluggable oracle, manual value is only a fallback
    // ------------------------------------------------------------------

    IPriceOracle public collateralPriceOracle;
    IPriceOracle public debtPriceOracle;

    /// @dev Fallback prices (1e6-scaled), used only if no oracle is set or its price is stale.
    uint64 public manualCollateralPrice;
    uint64 public manualDebtPrice;

    /// @notice Max oracle price age before falling back to the manual price. Owner-settable.
    uint256 public priceStalenessThreshold = 1 hours;

    // ------------------------------------------------------------------
    // Collateral ratio - owner-governed, bounds-checked, not a constant
    // ------------------------------------------------------------------

    /// @notice Minimum collateralization ratio in bps (15000 = 150%). Owner-adjustable within bounds.
    uint16 public collateralRatioBps = 15000;

    uint16 public constant MIN_COLLATERAL_RATIO_BPS = 11000; // 110% floor - below this is insolvent
    uint16 public constant MAX_COLLATERAL_RATIO_BPS = 50000; // 500% ceiling - sanity cap

    uint16 private constant BPS_DENOMINATOR = 10000;

    address public owner;

    mapping(address => euint64) private _collateral;
    mapping(address => bool) private _collateralInitialized;

    mapping(address => euint64) private _debt;
    mapping(address => bool) private _debtInitialized;

    event CollateralRatioUpdated(uint16 oldRatioBps, uint16 newRatioBps);
    event PriceOraclesUpdated(address collateralOracle, address debtOracle);
    event ManualPricesUpdated(uint64 collateralPrice, uint64 debtPrice);
    event PriceStalenessThresholdUpdated(uint256 newThreshold);

    modifier onlyOwner() {
        require(msg.sender == owner, "ConfidentialLending: not owner");
        _;
    }

    constructor(
        address collateralToken_,
        address debtToken_,
        uint64 initialManualCollateralPrice,
        uint64 initialManualDebtPrice
    ) {
        require(collateralToken_ != address(0) && debtToken_ != address(0), "ConfidentialLending: zero address");
        require(
            initialManualCollateralPrice > 0 && initialManualDebtPrice > 0,
            "ConfidentialLending: zero initial price"
        );
        collateralToken = IConfidentialToken(collateralToken_);
        debtToken = IConfidentialToken(debtToken_);
        manualCollateralPrice = initialManualCollateralPrice;
        manualDebtPrice = initialManualDebtPrice;
        owner = msg.sender;
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    /// @notice Set oracle addresses. Pass address(0) to fall back to the manual price for that asset.
    function setPriceOracles(address newCollateralOracle, address newDebtOracle) external onlyOwner {
        collateralPriceOracle = IPriceOracle(newCollateralOracle);
        debtPriceOracle = IPriceOracle(newDebtOracle);
        emit PriceOraclesUpdated(newCollateralOracle, newDebtOracle);
    }

    /// @notice Set fallback prices, used when no oracle is set or the oracle price is stale.
    function setManualPrices(uint64 newCollateralPrice, uint64 newDebtPrice) external onlyOwner {
        require(newCollateralPrice > 0 && newDebtPrice > 0, "ConfidentialLending: zero price");
        manualCollateralPrice = newCollateralPrice;
        manualDebtPrice = newDebtPrice;
        emit ManualPricesUpdated(newCollateralPrice, newDebtPrice);
    }

    /// @notice Set how long an oracle price stays valid before falling back to the manual price.
    function setPriceStalenessThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "ConfidentialLending: zero threshold");
        priceStalenessThreshold = newThreshold;
        emit PriceStalenessThresholdUpdated(newThreshold);
    }

    /// @notice Update the min collateral ratio, bounded to [MIN_COLLATERAL_RATIO_BPS, MAX_COLLATERAL_RATIO_BPS].
    function setCollateralRatioBps(uint16 newRatioBps) external onlyOwner {
        require(
            newRatioBps >= MIN_COLLATERAL_RATIO_BPS && newRatioBps <= MAX_COLLATERAL_RATIO_BPS,
            "ConfidentialLending: ratio out of bounds"
        );
        uint16 old = collateralRatioBps;
        collateralRatioBps = newRatioBps;
        emit CollateralRatioUpdated(old, newRatioBps);
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

    /// @notice Current effective collateral price (oracle if fresh, else manual fallback).
    function currentCollateralPrice() public view returns (uint64) {
        return _resolvePrice(collateralPriceOracle, manualCollateralPrice);
    }

    /// @notice Current effective debt price (oracle if fresh, else manual fallback).
    function currentDebtPrice() public view returns (uint64) {
        return _resolvePrice(debtPriceOracle, manualDebtPrice);
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

    /// @notice Withdraw collateral. Clamps to zero if it would exceed balance or break the health check.
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

    /// @notice Borrow against collateral. Clamps to zero if it would breach collateralRatioBps or exceed pool liquidity.
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

    /// @notice Repay debt. Clamps to outstanding debt so it can never go negative.
    function repay(externalEuint64 encryptedAmount, bytes calldata inputProof) external override returns (bool) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 currentDebt = debtBalanceOf(msg.sender);

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

    /// @notice Attempt to liquidate `account`. Only moves tokens if the position is actually
    ///         undercollateralized; otherwise everything clamps to zero and nothing leaks.
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

        // seize = repay * debtPrice / collateralPrice, clamped to account's actual collateral.
        // Dividing an encrypted value by a plaintext scalar is supported (only enc/enc div isn't).
        uint64 debtPriceNow = currentDebtPrice();
        uint64 collateralPriceNow = currentCollateralPrice();
        euint128 repayValue128 = FHE.mul(FHE.asEuint128(repayAmount), uint128(debtPriceNow));
        euint64 seizeAmount = FHE.asEuint64(FHE.div(repayValue128, uint128(collateralPriceNow)));
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

    /// @dev collateral * price * 10000 >= debt * price * collateralRatioBps. Cross-multiplied, no division.
    ///      Prices and ratio are read fresh each call, never hardcoded.
    function _isHealthy(euint64 collateralAmount, euint64 debtAmount) private returns (ebool) {
        uint64 collateralPriceNow = currentCollateralPrice();
        uint64 debtPriceNow = currentDebtPrice();
        euint128 collateralValue = FHE.mul(
            FHE.asEuint128(collateralAmount),
            uint128(uint256(collateralPriceNow) * BPS_DENOMINATOR)
        );
        euint128 debtValue = FHE.mul(
            FHE.asEuint128(debtAmount),
            uint128(uint256(debtPriceNow) * collateralRatioBps)
        );
        return FHE.ge(collateralValue, debtValue);
    }

    /// @dev Oracle price if set and fresh, else manual fallback. Reverts only if neither is valid.
    function _resolvePrice(IPriceOracle oracle, uint64 manualPrice) private view returns (uint64) {
        if (address(oracle) != address(0)) {
            (uint64 price, uint256 updatedAt) = oracle.latestPrice();
            if (price > 0 && block.timestamp - updatedAt <= priceStalenessThreshold) {
                return price;
            }
        }
        require(manualPrice > 0, "ConfidentialLending: no valid price");
        return manualPrice;
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