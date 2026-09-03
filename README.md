# Morphex

Morphex is a confidential constant-product exchange built with Zama fhEVM and OpenZeppelin ERC-7984.

Every protocol amount is encrypted: token balances and supply, mint quantities, swap input/output, pool reserves, LP balances, liquidity deposits/withdrawals, and execution receipts. The protocol never decrypts an amount on-chain.

## Privacy boundary

FHE encrypts values, not Ethereum itself. These remain public: wallet and contract addresses, pair identity, transaction timing/order, gas use, and the fact that a liquidity or swap function was called. Events deliberately contain no amounts.

## Architecture

```
wallet (encrypts amount + target) -> ERC-7984 token -> ConfidentialPair
                                                    -> FHE invariant checks
                                                    -> encrypted receipt for wallet
```

- `MorphexToken`: ERC-7984 confidential asset. `mint` takes an encrypted amount and proof.
- `ConfidentialPairFactory`: creates one canonical pair per two-token combination.
- `ConfidentialPair`: encrypted reserves and LP accounting; validates fee-adjusted `x*y=k` and proportional LP equations with FHE.

## Important AMM design detail

The installed fhEVM release supports encrypted multiplication/comparisons but not encrypted÷encrypted division or square root at usable circuit depth. Morphex therefore accepts an encrypted output target for swaps and an encrypted LP-share target for liquidity. The pair validates those values against the encrypted invariant; a stale or excessive target produces a confidential no-op/refund.

This keeps every value private and avoids trusting an on-chain oracle. The frontend can calculate targets for its own known liquidity, or obtain them from an optional quote service authorized to view a pool. A quote service is never able to bypass the pair's FHE checks.

## User flow

1. Encrypt every `uint64` input against the pair/token address using the Zama SDK.
2. Call `setOperator(pair, expiry)` on each ERC-7984 token the pair may pull.
3. Add liquidity with encrypted `amount0`, `amount1`, and `shareTarget`.
4. Swap with encrypted `amountIn` and `amountOutTarget`.
5. Read `lastSwapOf`/`lastLiquidityOf`, then decrypt only the caller-authorized receipt locally.

Invalid private checks do not expose a revert reason: the pair refunds the encrypted input and stores an encrypted `success = false` receipt.

## Development

```bash
npm install
npm run compile
npm test
npm run typecheck
```

The suite uses fhEVM mock mode for contract tests. It covers encrypted minting/transfers, private initial liquidity, successful swaps, and private failed-swap refunds.

## Deploy

### Local Development

```bash
npx hardhat node
npm run deploy:relayer-local
cd frontend && npm run dev
```

### Sepolia Testnet Deployment

1. **Configure credentials**: Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Set your deployer wallet `PRIVATE_KEY` (must have Sepolia ETH for gas). You can also set a custom `SEPOLIA_RPC_URL` if desired.

2. **Run pre-flight verification**:
   ```bash
   npm run verify:sepolia
   ```
   This checks RPC latency, Sepolia block height, deployer balance, and confirms Zama's FHEVM Coprocessor and ACL contracts are reachable on Sepolia.

3. **Deploy Core Protocol to Sepolia**:
   ```bash
   npm run deploy:sepolia:core
   ```
   This deploys `RelayerVault`, `ConfidentialPairFactory`, mock testnet tokens (`USDC`, `USDT`), confidential wrappers (`cUSDC`, `cUSDT`), the canonical `cUSDC-cUSDT` AMM pair, seeds initial confidential liquidity, and automatically updates `frontend/.env.local`.

4. **Fund a wallet with testnet tokens**:
   ```bash
   RECIPIENT=0xYourWalletAddress AMOUNT=1000 npm run faucet:sepolia
   ```
   Mints both public mock tokens (for vault deposits) and encrypted confidential tokens directly to your wallet for testing private swaps on Sepolia.

5. **Start Frontend**:
   ```bash
   cd frontend && npm run dev
   ```

### UPI on-ramp and crypto redemption

UPI is an entry-only payment rail. The local frontend mock verifies an INR payment and hands the settlement boundary to the relayer; the relayer must acquire or reserve real ERC-20 USDC/USDT backing before calling `relayerMint`. There is no UPI payout or INR off-ramp.

The exit remains crypto-only:

```text
UPI -> real ERC-20 backing -> cUSDC/cUSDT -> private swap -> cUSDC/cUSDT
    -> confidential burn -> relayer vault -> real ERC-20 -> user's wallet
```

Users submit `relayerBurnRequest` from the confidential wrapper and receive the corresponding underlying ERC-20 at the requesting wallet. The vault enforces that a relayer payout matches the request's wallet, token, and amount; the user escape hatch remains available after the configured delay.

### USDT/USDC relayer pair

The relayer flow is a bridge around confidential wrapper tokens. Deploy it with real ERC-20 addresses; do not substitute arbitrary token addresses on a public network:

```bash
TOKEN_ADDRESSES='{"USDT":"0x...","USDC":"0x...","LINK":"0x..."}' npm run deploy:relayer-pair
```

To deploy only verified assets you have configured, limit the catalog explicitly:

```bash
DEPLOY_SYMBOLS=USDC,USDT TOKEN_ADDRESSES='{"USDC":"0x...","USDT":"0x..."}' npm run deploy:relayer-pair
```

`DEPLOY_SYMBOLS` is optional and defaults to the full catalog. Every selected address must be a real ERC-20 on the target network; an RPC provider key does not replace these addresses.

For a Sepolia test deployment using official USDC plus a clearly labeled mock USDT, use `MOCK_SYMBOLS=USDT` and provide only the official USDC address. Mock tokens have no financial value and must not be used as production backing.

For a local demo with visible USDT and USDC assets, use the built-in mock public tokens:

```bash
npx hardhat node
npm run deploy:relayer-local
cp frontend/.env.relayer.local frontend/.env.local
cd frontend && npm run dev
```

The local public tokens are mocks. To give a wallet test balances, keep the deployer account imported in MetaMask and run:

```bash
LOCAL_USER=0xYourWalletAddress npm run faucet:local
```

This mints 1,000 units of every local public token to that address. Set `LOCAL_TOKEN_AMOUNT=10000` for a larger balance. The wallet still needs Hardhat ETH for gas, but it does not need real USDT or USDC.

This deploys one shared `RelayerVault`, one confidential wrapper per configured token, and direct pairs against cUSDC, then seeds encrypted test liquidity. The relayer signer must watch verified backing deposits or mock UPI settlement, mint the matching encrypted amount through the corresponding wrapper's `relayerMint`, and later submit encrypted burns followed by `batchWithdraw`. The vault does not automatically mint or swap: those actions require the off-chain relayer service and its accounting ledger.

The frontend now includes the supported Ethereum token catalog: USDT, USDC, LINK, SHIB, UNI, AAVE, PEPE, MKR, DAI, LDO, ONDO, ENA, WETH, WBTC, CRV, ARB, OP, POL, GRT, SAND, MANA, APE, IMX, AXS, COMP, SNX, RPL, ENS, PAXG, and FLOKI. A token becomes swappable only after its confidential wrapper and pair are deployed and included in `VITE_TOKEN_LIST`; unconfigured entries remain disabled in the selector.

## Security properties

- Uses ERC-7984 operator authorization; no custom unrestricted handle transfer is exposed.
- All mutable encrypted values receive ACL access for their owner and the contract that must process them.
- Fee-adjusted swap validation uses ciphertext-only arithmetic.
- Pair reserves are capped at `1e15` base units so fee-adjusted products fit the available encrypted 128-bit multiplication range.
- Reentrancy is blocked at pair entry points.

This is a complete contract protocol baseline, not an audited production deployment. A browser UI, quote-service policy, integration tests on Sepolia, and independent audit are required before mainnet use.



