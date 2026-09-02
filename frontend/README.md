# Morphex interface

This is the Electric Cyan DEX interface wired to the Morphex confidential pair.

## Run

1. For Sepolia, set `MNEMONIC` and `INFURA_API_KEY`, then run `npm run deploy:sepolia` from the repository root. The script writes the deployed addresses to `frontend/.env.local` automatically.
2. Start the frontend with `npm run dev` from this directory and switch your wallet to Sepolia when prompted.
3. Get Sepolia ETH from a faucet. The deployment account receives the initial encrypted token supply and the deployment seeds a `200,000 / 200,000` private MORPH/mUSD pool. Other wallets need test tokens distributed by the token owner before they can trade.

To distribute test tokens from the owner account:

```bash
MORPHEX_TOKEN_ADDRESS=0x... MORPHEX_RECIPIENT=0x... MORPHEX_AMOUNT=10000 npm run mint:testnet
```

The swap form encrypts the exact input and private output target with the Zama relayer SDK. Amounts are submitted as raw whole `uint64` units, matching the current contracts. The pair validates the target privately and refunds the input when it is stale or too high.

The selector shows tokens that are actually included in the deployment registry. Adding another token requires deploying an ERC-7984 confidential token, creating a `ConfidentialPair`, and seeding liquidity. Local Hardhat deployments are useful for contract tests, but the browser FHE relayer configuration in this interface targets Sepolia. Do not use local addresses for the Sepolia UI.