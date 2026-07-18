// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint128, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialToken} from "./ConfidentialToken.sol";

/// @notice Overcollateralized lending against a single ConfidentialToken pair.
/// Collateral/debt positions are encrypted; health checks compare cross-
/// multiplied values in euint128 rather than dividing, since fhEVM has no
/// encrypted/encrypted division. Prices are plaintext (values, not existence
/// of a position, are what need hiding here) and owner-governed with a
/// staleness guard rather than a pluggable oracle interface, to keep this to
/// exactly the contracts the protocol needs.
contract ConfidentialLending is ZamaEthereumConfig {
    event CollateralDeposited(address indexed account);
    event CollateralWithdrawn(address indexed account);
    event Borrowed(address indexed account);
    event Repaid(address indexed account);
    event LiquidationAttempted(address indexed account, address indexed liquidator);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CollateralRatioUpdated(uint16 newRatioBps);
    event PricesUpdated(uint64 collateralPrice, uint64 debtPrice);

    ConfidentialToken public immutable collateralToken;
    ConfidentialToken public immutable debtToken;

    // Both prices are scaled 1e6, matching ConfidentialToken's fixed 6 decimals.
    // No default baked in — every deployment must pass its own starting
    // prices and ratio into the constructor, since a hardcoded 1:1 price or
    // a hardcoded ratio would silently be wrong for any real asset pair.
    uint64 public collateralPrice;
    uint64 public debtPrice;
    uint256 public lastPriceUpdate;
    uint256 public constant PRICE_STALENESS_THRESHOLD = 1 hours;

    uint16 public collateralRatioBps;
    uint16 public constant MIN_COLLATERAL_RATIO_BPS = 11000; // 110% floor — owner can't set the protocol to near-zero safety margin
    uint16 private constant BPS_DENOMINATOR = 10000;

    address public owner;

    mapping(address => euint64) private _collateral;
    mapping(address => bool) private _collateralInitialized;

    mapping(address => euint64) private _debt;
    mapping(address => bool) private _debtInitialized;

    bool private _locked;

    modifier onlyOwner() {
        require(msg.sender == owner, "ConfidentialLending: not owner");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "ConfidentialLending: reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    // Gates the actions where an inaccurate price directly determines
    // solvency (borrowing more than you should, withdrawing collateral you
    // need, or a liquidation seizing the wrong amount). Deposits and repays
    // only ever improve health regardless of price, so they're left ungated.
    modifier pricesFresh() {
        require(block.timestamp - lastPriceUpdate <= PRICE_STALENESS_THRESHOLD, "ConfidentialLending: stale price");
        _;
    }

    constructor(
        address collateralToken_,
        address debtToken_,
        uint64 initialCollateralPrice,
        uint64 initialDebtPrice,
        uint16 initialCollateralRatioBps
    ) {
        require(collateralToken_ != address(0) && debtToken_ != address(0), "ConfidentialLending: zero address");
        require(initialCollateralPrice > 0 && initialDebtPrice > 0, "ConfidentialLending: zero price");
        require(initialCollateralRatioBps >= MIN_COLLATERAL_RATIO_BPS, "ConfidentialLending: ratio below floor");

        collateralToken = ConfidentialToken(collateralToken_);
        debtToken = ConfidentialToken(debtToken_);
        owner = msg.sender;

        collateralPrice = initialCollateralPrice;
        debtPrice = initialDebtPrice;
        collateralRatioBps = initialCollateralRatioBps;
        lastPriceUpdate = block.timestamp;
    }

    function setPrices(uint64 newCollateralPrice, uint64 newDebtPrice) external onlyOwner {
        require(newCollateralPrice > 0 && newDebtPrice > 0, "ConfidentialLending: zero price");
        collateralPrice = newCollateralPrice;
        debtPrice = newDebtPrice;
        lastPriceUpdate = block.timestamp;
        emit PricesUpdated(newCollateralPrice, newDebtPrice);
    }

    function setCollateralRatio(uint16 newRatioBps) external onlyOwner {
        require(newRatioBps >= MIN_COLLATERAL_RATIO_BPS, "ConfidentialLending: ratio below floor");
        collateralRatioBps = newRatioBps;
        emit CollateralRatioUpdated(newRatioBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ConfidentialLending: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function pricesAreFresh() external view returns (bool) {
        return block.timestamp - lastPriceUpdate <= PRICE_STALENESS_THRESHOLD;
    }

    function collateralBalanceOf(address account) public view returns (euint64) {
        return _collateralInitialized[account] ? _collateral[account] : euint64.wrap(0);
    }

    function debtBalanceOf(address account) public view returns (euint64) {
        return _debtInitialized[account] ? _debt[account] : euint64.wrap(0);
    }

    function depositCollateral(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        FHE.allowTransient(amount, address(collateralToken));
        euint64 moved = collateralToken.transferFromHandle(address(this), msg.sender, address(this), amount);

        _setCollateral(msg.sender, FHE.add(collateralBalanceOf(msg.sender), moved));
        emit CollateralDeposited(msg.sender);
        return true;
    }

    function withdrawCollateral(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant pricesFresh returns (bool) {
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

    function borrow(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant pricesFresh returns (bool) {
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

    function repay(externalEuint64 encryptedAmount, bytes calldata inputProof) external nonReentrant returns (bool) {
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

    function liquidate(
        address account,
        externalEuint64 encryptedRepayAmount,
        bytes calldata inputProof
    ) external nonReentrant pricesFresh returns (bool) {
        euint64 requestedRepay = FHE.fromExternal(encryptedRepayAmount, inputProof);

        euint64 accountCollateral = collateralBalanceOf(account);
        euint64 accountDebt = debtBalanceOf(account);

        ebool ok = FHE.and(FHE.not(_isHealthy(accountCollateral, accountDebt)), FHE.le(requestedRepay, accountDebt));

        euint64 repayAmount = FHE.select(ok, requestedRepay, FHE.asEuint64(0));

        FHE.allowTransient(repayAmount, address(debtToken));
        euint64 movedRepay = debtToken.transferFromHandle(address(this), msg.sender, address(this), repayAmount);

        // Convert the repaid debt value into collateral units. This divides
        // an encrypted value by a PLAINTEXT scalar (collateralPrice), which
        // fhEVM supports natively — it is not encrypted/encrypted division.
        euint64 rawSeize = FHE.asEuint64(
            FHE.div(FHE.mul(FHE.asEuint128(movedRepay), uint128(debtPrice)), uint128(collateralPrice))
        );
        euint64 seizeAmount = FHE.select(FHE.le(rawSeize, accountCollateral), rawSeize, accountCollateral);

        _setDebt(account, FHE.sub(accountDebt, movedRepay));
        _setCollateral(account, FHE.sub(accountCollateral, seizeAmount));

        FHE.allowTransient(seizeAmount, address(collateralToken));
        collateralToken.transferHandle(address(this), msg.sender, seizeAmount);

        emit LiquidationAttempted(account, msg.sender);
        return true;
    }

    // collateralValue >= debtValue * collateralRatioBps / BPS_DENOMINATOR,
    // cross-multiplied so neither side needs to divide an encrypted value by
    // another encrypted value.
    function _isHealthy(euint64 collateralAmount, euint64 debtAmount) private returns (ebool) {
        euint128 collateralValue = FHE.mul(
            FHE.asEuint128(collateralAmount),
            uint128(uint256(collateralPrice) * BPS_DENOMINATOR)
        );
        euint128 debtValue = FHE.mul(FHE.asEuint128(debtAmount), uint128(uint256(debtPrice) * collateralRatioBps));
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