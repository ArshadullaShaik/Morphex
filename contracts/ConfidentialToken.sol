// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IConfidentialToken} from "./interfaces/IConfidentialToken.sol";

/// @title ConfidentialToken
/// @notice ERC-7984-style confidential token. Balances/allowances are euint64 handles; amounts never appear on-chain.
///
/// @dev Notes:
///      - Allowance/balance checks must gate the transfer via `FHE.select`, clamping to zero on failure —
///        never just compute a check and ignore it.
///      - Failures are silent no-ops (amount = 0), not reverts, so tx success/failure can't leak info.
///      - Uses fhevm/solidity v0.11.1: external ciphertexts are `externalEuint64`, decoded via `FHE.fromExternal`.
contract ConfidentialToken is IConfidentialToken, ZamaEthereumConfig {
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;

    mapping(address => euint64) private _balances;
    mapping(address => mapping(address => euint64)) private _allowances;

    /// @dev Marks whether a handle exists yet, so first reads return a fresh zero instead of an invalid handle.
    mapping(address => bool) private _balanceInitialized;
    mapping(address => mapping(address => bool)) private _allowanceInitialized;

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function confidentialBalanceOf(address account) public view override returns (euint64) {
        if (!_balanceInitialized[account]) {
            return euint64.wrap(0);
        }
        return _balances[account];
    }

    function confidentialAllowance(address owner, address spender) public view override returns (euint64) {
        if (!_allowanceInitialized[owner][spender]) {
            return euint64.wrap(0);
        }
        return _allowances[owner][spender];
    }

    // ------------------------------------------------------------------
    // Minting (testing convenience — add access control before production)
    // ------------------------------------------------------------------

    /// @notice Mint an encrypted amount to `to`. Unrestricted for now; add `Ownable` etc. for production.
    function mint(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _credit(to, amount);
        emit Transfer(address(0), to);
        return true;
    }

    // ------------------------------------------------------------------
    // Transfers (client-encrypted input)
    // ------------------------------------------------------------------

    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _transfer(msg.sender, to, amount);
        return true;
    }

    function confidentialTransfer(address to, euint64 amount) external override returns (bool) {
        FHE.isSenderAllowed(amount); // reverts if caller lacks ACL rights over the handle
        _transfer(msg.sender, to, amount);
        return true;
    }

    function confidentialApprove(
        address spender,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _approve(msg.sender, spender, amount);
        return true;
    }

    function confidentialApprove(address spender, euint64 amount) external override returns (bool) {
        FHE.isSenderAllowed(amount);
        _approve(msg.sender, spender, amount);
        return true;
    }

    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _transferFrom(msg.sender, from, to, amount);
        return true;
    }

    function confidentialTransferFrom(address from, address to, euint64 amount) external override returns (bool) {
        FHE.isSenderAllowed(amount);
        _transferFrom(msg.sender, from, to, amount);
        return true;
    }

    // ------------------------------------------------------------------
    // Composability hooks — for other confidential contracts (e.g. a swap/AMM)
    // ------------------------------------------------------------------

    /// @dev Caller contract must already hold ACL rights over `amount`. Handle-based, not proof-based,
    ///      since input proofs can't be replayed across contract addresses.
    function transferHandle(address from, address to, euint64 amount) external override returns (euint64) {
        FHE.isSenderAllowed(amount);
        return _transferAsCaller(from, to, amount);
    }

    function transferFromHandle(
        address spender,
        address from,
        address to,
        euint64 amount
    ) external override returns (euint64) {
        FHE.isSenderAllowed(amount);
        return _transferFromAsCaller(spender, from, to, amount);
    }

    // ------------------------------------------------------------------
    // Internal logic
    // ------------------------------------------------------------------

    function _credit(address to, euint64 amount) internal {
        euint64 newBalance = FHE.add(confidentialBalanceOf(to), amount);
        _setBalance(to, newBalance);
    }

    function _transfer(address from, address to, euint64 amount) internal {
        _transferAsCaller(from, to, amount);
        emit Transfer(from, to);
    }

    /// @dev Shared by `confidentialTransfer` and `transferHandle`. `from` is debited directly.
    function _transferAsCaller(address from, address to, euint64 amount) internal returns (euint64) {
        euint64 fromBalance = confidentialBalanceOf(from);

        // Clamp to zero instead of reverting, so insufficient balance isn't leaked.
        ebool canTransfer = FHE.le(amount, fromBalance);
        euint64 transferAmount = FHE.select(canTransfer, amount, FHE.asEuint64(0));

        euint64 newFromBalance = FHE.sub(fromBalance, transferAmount);
        euint64 newToBalance = FHE.add(confidentialBalanceOf(to), transferAmount);

        _setBalance(from, newFromBalance);
        _setBalance(to, newToBalance);

        // Let sender decrypt what actually moved.
        FHE.allow(transferAmount, from);
        return transferAmount;
    }

    function _transferFromAsCaller(
        address spender,
        address from,
        address to,
        euint64 amount
    ) internal returns (euint64) {
        euint64 currentAllowance = confidentialAllowance(from, spender);
        euint64 fromBalance = confidentialBalanceOf(from);

        ebool allowanceOk = FHE.le(amount, currentAllowance);
        ebool balanceOk = FHE.le(amount, fromBalance);
        ebool ok = FHE.and(allowanceOk, balanceOk);

        euint64 transferAmount = FHE.select(ok, amount, FHE.asEuint64(0));

        euint64 newAllowance = FHE.sub(currentAllowance, transferAmount);
        euint64 newFromBalance = FHE.sub(fromBalance, transferAmount);
        euint64 newToBalance = FHE.add(confidentialBalanceOf(to), transferAmount);

        _setAllowance(from, spender, newAllowance);
        _setBalance(from, newFromBalance);
        _setBalance(to, newToBalance);

        FHE.allow(transferAmount, spender);
        emit Transfer(from, to);
        return transferAmount;
    }

    function _transferFrom(address spender, address from, address to, euint64 amount) internal {
        _transferFromAsCaller(spender, from, to, amount);
    }

    function _approve(address owner, address spender, euint64 amount) internal {
        _setAllowance(owner, spender, amount);
        emit Approval(owner, spender);
    }

    function _setBalance(address account, euint64 newBalance) internal {
        _balances[account] = newBalance;
        _balanceInitialized[account] = true;
        // Grant ACL: contract itself + account owner (for client-side decryption).
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, account);
    }

    function _setAllowance(address owner, address spender, euint64 newAllowance) internal {
        _allowances[owner][spender] = newAllowance;
        _allowanceInitialized[owner][spender] = true;
        FHE.allowThis(newAllowance);
        FHE.allow(newAllowance, owner);
        FHE.allow(newAllowance, spender);
    }
}