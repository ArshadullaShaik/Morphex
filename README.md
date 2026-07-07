# Morphex

**FHE-based DeFi protocol** — confidential tokens, swaps, and lending powered by Fully Homomorphic Encryption.

Built on [Zama fhEVM](https://docs.zama.ai/fhevm) — write plain Solidity with encrypted types (`euint64`, `ebool`) that the FHE coprocessor computes on without decrypting.

## Architecture

```
┌─────────────┐      encrypted tx       ┌──────────────────┐
│   Frontend   │ ───────────────────────▶│  Host chain (EVM) │
│ (encrypt/    │                          │  - Morphex        │
│  decrypt via │◀─────────────────────────│    contracts      │
│  JS SDK)     │   decrypted results      │  - fhEVM executor │
└─────────────┘   (only if authorized)    └─────────┬─────────┘
                                                     │
                                          ┌──────────▼───────────┐
                                          │ Coprocessor network   │
                                          │ (does actual FHE math)│
                                          └───────────┬───────────┘
                                                      │
                                          ┌───────────▼───────────┐
                                          │ KMS (threshold/MPC)    │
                                          │ decryption + ACL check │
                                          └───────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **npm** (or pnpm/yarn)

### Install & Build

```bash
npm install
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

Tests run in **mock FHE mode** — no coprocessor or testnet needed.

### Deploy Locally

```bash
npx hardhat node          # Start local node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
# Set secrets (one-time)
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY

# Deploy
npx hardhat deploy --network sepolia
```

## Contracts

### ConfidentialToken (`MORPH`)

ERC-7984 confidential fungible token.

| Feature | Detail |
|---|---|
| Balances | Encrypted `euint64` — only the owner can decrypt via KMS |
| Transfers | Encrypted amounts — observers see `Transfer(from, to)` but never the amount |
| Failed transfers | **No-op, not revert** — `FHE.select` prevents info leakage |
| Allowances | Encrypted — same `FHE.select` pattern for `transferFrom` |
| Minting | Owner-only, plaintext amount (deployer already knows it) |

### Security Design

1. **`FHE.select` over `require()`** — A revert reveals "this condition was false", leaking information. All encrypted condition checks use `FHE.select(condition, valueIfTrue, valueIfFalse)` to resolve to a silent no-op on failure.

2. **ACL grants on every mutation** — After every balance/allowance write: `FHE.allow(handle, owner)` so the user can decrypt their own state, and `FHE.allow(handle, address(this))` so the contract can use it in future operations.

3. **Events omit amounts** — `Transfer(from, to)` carries no amount. The amount is encrypted and only visible to authorized parties.

## Project Structure

```
Morphex/
├── contracts/
│   ├── ConfidentialToken.sol       # Core ERC-7984 token
│   └── interfaces/
│       └── IConfidentialToken.sol   # Interface for composability
├── deploy/
│   └── deploy.ts                   # Deployment + initial mint
├── test/
│   ├── helpers.ts                  # Shared test utilities
│   └── ConfidentialToken.test.ts   # Full test suite
├── hardhat.config.ts
├── package.json
└── README.md
```

## Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Confidential token (MORPH) | ✅ |
| 2 | Private swap / AMM (x·y=k with encrypted reserves) | 🔲 |
| 3 | Lending/borrowing or sealed-bid mechanism | 🔲 |
| 4 | Frontend (React + Zama JS SDK) | 🔲 |
| 5 | Security review & audit | 🔲 |

## Trust Assumptions

- **FHE Coprocessor**: Zama's coprocessor network performs encrypted computation. You trust that the coprocessors execute correctly.
- **KMS (Key Management Service)**: Uses threshold MPC across multiple operators. Decryption requires a quorum. Understand who these operators are.
- **MEV**: FHE hides *contents* but not *ordering*. Transaction sequencing attacks are still possible — fair-ordering or commit-reveal mechanisms may be needed on top.
- **Gas**: FHE operations are ~100x more expensive than plaintext. Only encrypt what needs to be private (balances, amounts — not token name/decimals).

## License

MIT
