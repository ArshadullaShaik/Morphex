// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract ConfidentialToken is ZamaEthereumConfig {
    event Transfer(address indexed from, address indexed to);
    event Approval(address indexed owner, address indexed spender);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    string public name;
    string public symbol;
    uint8 public constant decimals = 6;
    address public owner;

    mapping(address => euint64) private _balances;
    mapping(address => mapping(address => euint64)) private _allowances;

    mapping(address => bool) private _balanceInitialized;
    mapping(address => mapping(address => bool)) private _allowanceInitialized;

    modifier onlyOwner() {
        require(msg.sender == owner, "ConfidentialToken: not owner");
        _;
    }

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ConfidentialToken: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function confidentialBalanceOf(address account) public view returns (euint64) {
        if (!_balanceInitialized[account]) {
            return euint64.wrap(0);
        }
        return _balances[account];
    }

    function confidentialAllowance(address holder, address spender) public view returns (euint64) {
        if (!_allowanceInitialized[holder][spender]) {
            return euint64.wrap(0);
        }
        return _allowances[holder][spender];
    }

    // Owner-gated mint. Kept simple on purpose: this token is the shared
    // settlement asset for ConfidentialSwap / ConfidentialLending, not a
    // public-sale token, so supply issuance stays admin-controlled.
    function mint(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external onlyOwner returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _credit(to, amount);
        emit Transfer(address(0), to);
        return true;
    }

    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _transfer(msg.sender, to, amount);
        return true;
    }

    function confidentialTransfer(address to, euint64 amount) external returns (bool) {
        FHE.isSenderAllowed(amount);
        _transfer(msg.sender, to, amount);
        return true;
    }

    function confidentialApprove(
        address spender,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _approve(msg.sender, spender, amount);
        return true;
    }

    function confidentialApprove(address spender, euint64 amount) external returns (bool) {
        FHE.isSenderAllowed(amount);
        _approve(msg.sender, spender, amount);
        return true;
    }

    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _transferFrom(msg.sender, from, to, amount);
        return true;
    }

    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (bool) {
        FHE.isSenderAllowed(amount);
        _transferFrom(msg.sender, from, to, amount);
        return true;
    }

    // Handle-based hooks used by trusted protocol contracts (ConfidentialSwap,
    // ConfidentialLending) to move funds they already hold approval/handles for,
    // without needing a fresh external ciphertext + proof on every internal hop.
    function transferHandle(address from, address to, euint64 amount) external returns (euint64) {
        FHE.isSenderAllowed(amount);
        return _transferAsCaller(from, to, amount);
    }

    function transferFromHandle(
        address spender,
        address from,
        address to,
        euint64 amount
    ) external returns (euint64) {
        FHE.isSenderAllowed(amount);
        return _transferFromAsCaller(spender, from, to, amount);
    }

    function _credit(address to, euint64 amount) internal {
        euint64 newBalance = FHE.add(confidentialBalanceOf(to), amount);
        _setBalance(to, newBalance);
    }

    function _transfer(address from, address to, euint64 amount) internal {
        _transferAsCaller(from, to, amount);
        emit Transfer(from, to);
    }

    // All-or-nothing: if `amount` exceeds the real balance, the whole transfer
    // clamps to zero via FHE.select rather than reverting. Reverting on a
    // failed encrypted comparison would itself leak information (observers
    // could infer "this account didn't have enough").
    function _transferAsCaller(address from, address to, euint64 amount) internal returns (euint64) {
        euint64 fromBalance = confidentialBalanceOf(from);

        ebool canTransfer = FHE.le(amount, fromBalance);
        euint64 transferAmount = FHE.select(canTransfer, amount, FHE.asEuint64(0));

        euint64 newFromBalance = FHE.sub(fromBalance, transferAmount);
        euint64 newToBalance = FHE.add(confidentialBalanceOf(to), transferAmount);

        _setBalance(from, newFromBalance);
        _setBalance(to, newToBalance);

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

    function _approve(address holder, address spender, euint64 amount) internal {
        _setAllowance(holder, spender, amount);
        emit Approval(holder, spender);
    }

    function _setBalance(address account, euint64 newBalance) internal {
        _balances[account] = newBalance;
        _balanceInitialized[account] = true;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, account);
    }

    function _setAllowance(address holder, address spender, euint64 newAllowance) internal {
        _allowances[holder][spender] = newAllowance;
        _allowanceInitialized[holder][spender] = true;
        FHE.allowThis(newAllowance);
        FHE.allow(newAllowance, holder);
        FHE.allow(newAllowance, spender);
    }
}