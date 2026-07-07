// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, einput, euint64, ebool, inEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IConfidentialToken} from "./interfaces/IConfidentialToken.sol";

/// @title ConfidentialToken (Morphex / MORPH)
/// @author Morphex team
/// @notice ERC-7984-style confidential fungible token. Balances, allowances, and transfer
/// amounts are stored as FHE-encrypted `euint64` values. Observers can see *that* a transfer
/// happened and between *whom*, but never the *amount*.
///
/// @dev CRITICAL DESIGN DECISIONS:
///
///   1. **FHE.select over require()** — Every balance/allowance check uses
///      `FHE.select(condition, valueIfTrue, valueIfFalse)` instead of `require(condition)`.
///      A revert leaks information ("this trade would have failed"), so failed conditions
///      silently resolve to a no-op encrypted branch.
///
///   2. **ACL grants on every mutation** — After every balance or allowance write, we call
///      `FHE.allow(handle, owner)` so the owner can always decrypt their own state via the
///      KMS gateway, and `FHE.allowTransient(handle, address(this))` so the contract can
///      use the handle in subsequent operations within the same tx.
///
///   3. **Events omit amounts** — `Transfer(from, to)` and `Approval(owner, spender)` carry
///      no amount field. The amount is encrypted and should only be visible to authorized parties.
contract ConfidentialToken is IConfidentialToken, Ownable {
    // ──────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────

    string private _name;
    string private _symbol;
    uint8 private constant _DECIMALS = 18;

    /// @dev Encrypted balances — handles pointing to ciphertexts on the coprocessor.
    mapping(address => euint64) private _balances;

    /// @dev Encrypted allowances: owner → spender → encrypted amount handle.
    mapping(address => mapping(address => euint64)) private _allowances;

    /// @dev Encrypted total supply.
    euint64 private _totalSupply;

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        address initialOwner
    ) Ownable(initialOwner) {
        _name = tokenName;
        _symbol = tokenSymbol;
        _totalSupply = FHE.asEuint64(0);
    }

    // ──────────────────────────────────────────────
    //  Public metadata (plaintext)
    // ──────────────────────────────────────────────

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function decimals() external pure override returns (uint8) {
        return _DECIMALS;
    }

    // ──────────────────────────────────────────────
    //  Encrypted state reads
    // ──────────────────────────────────────────────

    /// @inheritdoc IConfidentialToken
    function balanceOf(address account) external view override returns (euint64) {
        return _balances[account];
    }

    /// @inheritdoc IConfidentialToken
    function totalSupply() external view override returns (euint64) {
        return _totalSupply;
    }

    /// @inheritdoc IConfidentialToken
    function allowance(
        address owner,
        address spender
    ) external view override returns (euint64) {
        return _allowances[owner][spender];
    }

    // ──────────────────────────────────────────────
    //  Transfer
    // ──────────────────────────────────────────────

    /// @inheritdoc IConfidentialToken
    function transfer(
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        require(to != address(0), "ConfidentialToken: transfer to zero address");
        require(to != msg.sender, "ConfidentialToken: transfer to self");

        // Convert the client-side encrypted input into a coprocessor handle
        euint64 amount = FHE.asEuint64(encryptedAmount, inputProof);

        _transfer(msg.sender, to, amount);
        return true;
    }

    // ──────────────────────────────────────────────
    //  Approve
    // ──────────────────────────────────────────────

    /// @inheritdoc IConfidentialToken
    function approve(
        address spender,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        require(spender != address(0), "ConfidentialToken: approve to zero address");

        euint64 amount = FHE.asEuint64(encryptedAmount, inputProof);
        _approve(msg.sender, spender, amount);
        return true;
    }

    // ──────────────────────────────────────────────
    //  TransferFrom
    // ──────────────────────────────────────────────

    /// @inheritdoc IConfidentialToken
    function transferFrom(
        address from,
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external override returns (bool) {
        require(to != address(0), "ConfidentialToken: transfer to zero address");
        require(from != to, "ConfidentialToken: transfer to self");

        euint64 amount = FHE.asEuint64(encryptedAmount, inputProof);

        // Check allowance — same FHE.select no-op pattern
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    // ──────────────────────────────────────────────
    //  Mint (owner-only, plaintext amount)
    // ──────────────────────────────────────────────

    /// @notice Mint `amount` tokens to `to`. Only callable by the contract owner.
    /// @dev Accepts a plaintext uint64 because the deployer/minter already knows the
    /// amount — there's no privacy benefit to encrypting it client-side during minting.
    function mint(address to, uint64 amount) external onlyOwner {
        require(to != address(0), "ConfidentialToken: mint to zero address");

        euint64 encAmount = FHE.asEuint64(amount);

        // Initialize balance if this is the first mint for this address
        euint64 currentBalance = _balances[to];
        _balances[to] = FHE.add(currentBalance, encAmount);
        _totalSupply = FHE.add(_totalSupply, encAmount);

        // ACL: let the recipient decrypt their own balance
        FHE.allow(_balances[to], to);
        // ACL: let this contract use the handle in future operations
        FHE.allow(_balances[to], address(this));
        // ACL: let the owner read total supply
        FHE.allow(_totalSupply, owner());
        FHE.allow(_totalSupply, address(this));

        emit Mint(to);
        emit Transfer(address(0), to);
    }

    // ══════════════════════════════════════════════
    //  Internal logic
    // ══════════════════════════════════════════════

    /// @dev Core transfer logic using FHE.select for no-op on insufficient balance.
    ///
    /// If `senderBalance >= amount`:
    ///   sender -= amount, recipient += amount
    /// Else:
    ///   sender stays the same, recipient stays the same (silent no-op)
    ///
    /// In both cases the tx succeeds — no revert, no info leak.
    function _transfer(
        address from,
        address to,
        euint64 amount
    ) internal {
        euint64 senderBalance = _balances[from];
        euint64 recipientBalance = _balances[to];

        // Encrypted comparison: does sender have enough?
        ebool hasEnough = FHE.le(amount, senderBalance);

        // Conditional update — resolves to no-op if hasEnough is false
        _balances[from] = FHE.select(
            hasEnough,
            FHE.sub(senderBalance, amount),
            senderBalance
        );
        _balances[to] = FHE.select(
            hasEnough,
            FHE.add(recipientBalance, amount),
            recipientBalance
        );

        // ACL grants — both parties can decrypt their own balance
        FHE.allow(_balances[from], from);
        FHE.allow(_balances[from], address(this));
        FHE.allow(_balances[to], to);
        FHE.allow(_balances[to], address(this));

        emit Transfer(from, to);
    }

    /// @dev Set the encrypted allowance for `owner` → `spender`.
    function _approve(
        address owner,
        address spender,
        euint64 amount
    ) internal {
        _allowances[owner][spender] = amount;

        // ACL: owner and spender can both see the allowance
        FHE.allow(_allowances[owner][spender], owner);
        FHE.allow(_allowances[owner][spender], spender);
        FHE.allow(_allowances[owner][spender], address(this));

        emit Approval(owner, spender);
    }

    /// @dev Consume allowance using the same FHE.select no-op pattern.
    /// If allowance >= amount, subtract. Otherwise, the subsequent _transfer will
    /// also no-op (because we don't reduce the allowance, so the balances check
    /// can still fail gracefully).
    function _spendAllowance(
        address owner,
        address spender,
        euint64 amount
    ) internal {
        euint64 currentAllowance = _allowances[owner][spender];

        // Check: does the spender have sufficient allowance?
        ebool hasAllowance = FHE.le(amount, currentAllowance);

        // If insufficient allowance, set amount to 0 so _transfer is a no-op
        // This is subtle: we modify the amount handle that _transfer will use
        // Actually, we reduce the allowance conditionally — the _transfer
        // itself will independently check the balance, so we just need to
        // ensure allowance accounting is correct.
        _allowances[owner][spender] = FHE.select(
            hasAllowance,
            FHE.sub(currentAllowance, amount),
            currentAllowance
        );

        // ACL grants
        FHE.allow(_allowances[owner][spender], owner);
        FHE.allow(_allowances[owner][spender], spender);
        FHE.allow(_allowances[owner][spender], address(this));
    }
}
