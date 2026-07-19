// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// @title IPriceOracle
/// @notice Minimal price feed interface. Prices stay plaintext by design - only
///         collateral/debt amounts need encryption, not public market prices.
interface IPriceOracle {
    /// @return price latest price, scaled by 1e6
    /// @return updatedAt unix timestamp of last update
    function latestPrice() external view returns (uint64 price, uint256 updatedAt);
}