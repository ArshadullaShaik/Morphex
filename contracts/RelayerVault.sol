// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title RelayerVault
/// @notice Minimal custody vault for pooled stablecoin deposits and batched relayer payouts.
/// @dev This is intentionalets put relayer lly a custodial, pooled design. The relayer may batch and net public
///      payouts off-chain. Users trust the relayer to act honestly and promptly, or use the
///      escape hatch after ESCAPE_HATCH_DELAY. This is not a trustless or cryptographically
///      private design; it is a controlled public ledger for a semi-trusted relayer service.
contract RelayerVault is ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    address public relayerSigner;
    uint256 public immutable ESCAPE_HATCH_DELAY;
    uint256 public nextRequestId;

    struct WithdrawalRequest {
        address user;
        address recipient;
        address token;
        uint256 amount;
        uint256 requestedAt;
        bool fulfilled;
        bool escaped;
    }

    struct Payout {
        address recipient;
        address token;
        uint256 amount;
    }

    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    event Deposited(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed recipient, address indexed token, uint256 amount, uint256 timestamp);
    event WithdrawalRequested(
        address indexed user,
        uint256 indexed requestId,
        address indexed token,
        address recipient,
        uint256 amount,
        uint256 requestedAt
    );
    event EscapeHatchClaimed(
        uint256 indexed requestId,
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Placeholder for local testing only; production should use a multisig-controlled relayer role.
    constructor(address admin, address initialRelayer, uint256 escapeHatchDelay_) {
        require(admin != address(0), "RelayerVault: zero admin");
        require(initialRelayer != address(0), "RelayerVault: zero relayer");
        require(escapeHatchDelay_ > 0, "RelayerVault: invalid delay");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        relayerSigner = initialRelayer;
        _grantRole(RELAYER_ROLE, initialRelayer);
        ESCAPE_HATCH_DELAY = escapeHatchDelay_;
    }

    /// @notice Grants relayer authority to the configured signer or multisig-controlled service.
    function setRelayer(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(relayer != address(0), "RelayerVault: zero relayer");
        if (relayerSigner != address(0)) {
            _revokeRole(RELAYER_ROLE, relayerSigner);
        }
        relayerSigner = relayer;
        _grantRole(RELAYER_ROLE, relayer);
    }

    /// @notice Alias used by local tests for signer rotation. Production should prefer a multisig-admin-controlled rotation flow.
    function setRelayerSigner(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(relayer != address(0), "RelayerVault: zero relayer");
        if (relayerSigner != address(0)) {
            _revokeRole(RELAYER_ROLE, relayerSigner);
        }
        relayerSigner = relayer;
        _grantRole(RELAYER_ROLE, relayer);
    }

    /// @notice Deposits public stablecoin into the vault. This is intentionally not amount-hiding.
    function deposit(address token, uint256 amount) external nonReentrant {
        require(token != address(0), "RelayerVault: zero token");
        require(amount > 0, "RelayerVault: zero amount");

        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
        emit Deposited(msg.sender, token, amount, block.timestamp);
    }

    /// @notice Registers a user intent to withdraw public funds to their own address. Called from the confidential burn bridge.
    function registerWithdrawalRequest(address user, address token, uint256 amount)
        external
        nonReentrant
        returns (uint256 requestId)
    {
        return _registerWithdrawalRequest(user, user, token, amount);
    }

    /// @notice Registers a user intent to withdraw public funds to a different recipient. Called from the confidential burn bridge.
    function registerWithdrawalRequestTo(address user, address recipient, address token, uint256 amount)
        external
        nonReentrant
        returns (uint256 requestId)
    {
        return _registerWithdrawalRequest(user, recipient, token, amount);
    }

    function _registerWithdrawalRequest(address user, address recipient, address token, uint256 amount)
        internal
        returns (uint256 requestId)
    {
        require(user != address(0), "RelayerVault: zero user");
        require(recipient != address(0), "RelayerVault: zero recipient");
        require(token != address(0), "RelayerVault: zero token");
        require(amount > 0, "RelayerVault: zero amount");

        requestId = ++nextRequestId;
        withdrawalRequests[requestId] = WithdrawalRequest({
            user: user,
            recipient: recipient,
            token: token,
            amount: amount,
            requestedAt: block.timestamp,
            fulfilled: false,
            escaped: false
        });

        emit WithdrawalRequested(user, requestId, token, recipient, amount, block.timestamp);
    }

    /// @notice Pays out a batch of withdrawals in one transaction, authorized by the relayer role.
    function batchWithdraw(Payout[] calldata payouts, uint256[] calldata requestIds)
        external
        nonReentrant
        onlyRole(RELAYER_ROLE)
    {
        require(payouts.length == requestIds.length, "RelayerVault: mismatched inputs");

        for (uint256 i = 0; i < payouts.length; ++i) {
            Payout calldata payout = payouts[i];
            require(payout.recipient != address(0), "RelayerVault: zero recipient");
            require(payout.token != address(0), "RelayerVault: zero token");
            require(payout.amount > 0, "RelayerVault: zero amount");

            if (requestIds[i] != 0) {
                WithdrawalRequest storage request = withdrawalRequests[requestIds[i]];
                require(request.user != address(0), "RelayerVault: unknown request");
                require(!request.fulfilled, "RelayerVault: already fulfilled");
                require(payout.recipient == request.recipient, "RelayerVault: recipient mismatch");
                require(payout.token == request.token, "RelayerVault: token mismatch");
                require(payout.amount == request.amount, "RelayerVault: amount mismatch");
                request.fulfilled = true;
                request.escaped = false;
            }

            SafeERC20.safeTransfer(IERC20(payout.token), payout.recipient, payout.amount);
            emit Withdrawn(payout.recipient, payout.token, payout.amount, block.timestamp);
        }
    }

    /// @notice Allows the user to bypass the relayer after the configured delay if it has not yet paid out.
    function claimEscapedWithdrawal(uint256 requestId) external nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        require(request.user != address(0), "RelayerVault: unknown request");
        require(msg.sender == request.user, "RelayerVault: not owner");
        require(!request.fulfilled, "RelayerVault: already fulfilled");
        require(block.timestamp >= request.requestedAt + ESCAPE_HATCH_DELAY, "RelayerVault: delay not elapsed");

        request.fulfilled = true;
        request.escaped = true;

        SafeERC20.safeTransfer(IERC20(request.token), request.recipient, request.amount);
        emit EscapeHatchClaimed(requestId, request.user, request.token, request.amount, block.timestamp);
        emit Withdrawn(msg.sender, request.token, request.amount, block.timestamp);
    }

    /// @notice Returns the vault's public balance for a given token as a solvency signal for off-chain tooling.
    function reserves(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Gets a request record for off-chain observability or direct user claim checks.
    function getWithdrawalRequest(uint256 requestId)
        external
        view
        returns (address user, address recipient, address token, uint256 amount, uint256 requestedAt, bool fulfilled, bool escaped)
    {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        return (
            request.user,
            request.recipient,
            request.token,
            request.amount,
            request.requestedAt,
            request.fulfilled,
            request.escaped
        );
    }
}
