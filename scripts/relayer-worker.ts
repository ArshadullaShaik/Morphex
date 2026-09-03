import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [relayer] = await ethers.getSigners();

  console.log("==================================================");
  console.log("  Morphex — Relayer Deposit Processor");
  console.log("==================================================");
  console.log(`Relayer address: ${relayer.address}\n`);

  // 1. Read contract configuration
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const vaultMatch = envContent.match(/VITE_RELAYER_VAULT_ADDRESS=(0x[a-fA-F0-9]+)/);
  const publicTokensMatch = envContent.match(/VITE_PUBLIC_TOKEN_LIST=(\[.*\])/);
  const confidentialTokensMatch = envContent.match(/VITE_TOKEN_LIST=(\[.*\])/);

  if (!vaultMatch || !publicTokensMatch || !confidentialTokensMatch) {
    throw new Error("Missing contract addresses in frontend/.env.local");
  }

  const vaultAddress = vaultMatch[1];
  const publicTokens = JSON.parse(publicTokensMatch[1]);
  const confidentialTokens = JSON.parse(confidentialTokensMatch[1]);

  const vault = await ethers.getContractAt("RelayerVault", vaultAddress, relayer);

  // 2. Query recent Deposited events
  const currentBlock = await ethers.provider.getBlockNumber();
  const filter = vault.filters.Deposited();
  const events = await vault.queryFilter(filter, Math.max(0, currentBlock - 2000));

  console.log(`Scanning RelayerVault (${vaultAddress})...`);
  console.log(`Found ${events.length} deposit event(s) in the last 2000 blocks.\n`);

  if (events.length === 0) {
    console.log("No pending deposits found.");
    return;
  }

  // Map public token address -> confidential token wrapper
  const tokenMap = new Map<string, any>();
  for (const pub of publicTokens) {
    const matchingConf = confidentialTokens.find((c: any) => c.symbol === `c${pub.symbol}`);
    if (matchingConf) {
      tokenMap.set(pub.address.toLowerCase(), {
        publicSymbol: pub.symbol,
        confidentialSymbol: matchingConf.symbol,
        confidentialAddress: matchingConf.address,
      });
    }
  }

  // Process each deposit event
  for (let i = 0; i < events.length; i++) {
    const e = events[i] as any;
    const { user, token, amount } = e.args;
    const mapping = tokenMap.get(token.toLowerCase());

    if (!mapping) {
      console.warn(`[SKIP] Deposit #${i + 1}: No confidential wrapper found for token ${token}`);
      continue;
    }

    const amountFormatted = ethers.formatUnits(amount, 6);
    console.log(`--- Processing Deposit #${i + 1} ---`);
    console.log(`User:         ${user}`);
    console.log(`Token:        ${mapping.publicSymbol} -> ${mapping.confidentialSymbol}`);
    console.log(`Amount:       ${amountFormatted} ${mapping.publicSymbol}`);
    console.log(`Deposit Tx:   https://sepolia.etherscan.io/tx/${e.transactionHash}`);

    const cTokenContract = await ethers.getContractAt("MorphexToken", mapping.confidentialAddress, relayer);

    // Verify relayer role
    const isRelayer = await cTokenContract.hasRole(await cTokenContract.RELAYER_ROLE(), relayer.address);
    if (!isRelayer) {
      console.error(`[ERROR] Signer ${relayer.address} does not have RELAYER_ROLE on ${mapping.confidentialSymbol}!`);
      continue;
    }

    console.log(`Generating encrypted FHE input for ${user}...`);
    const input = fhevm.createEncryptedInput(mapping.confidentialAddress, user);
    input.add64(BigInt(amount));
    const encrypted = await input.encrypt();

    console.log(`Calling relayerMint on ${mapping.confidentialSymbol}...`);
    try {
      const tx = await cTokenContract.relayerMint(user, encrypted.handles[0], encrypted.inputProof);
      console.log(`Submitted tx: ${tx.hash}`);
      console.log("Waiting for confirmation on Sepolia...");
      await tx.wait();
      console.log(`[SUCCESS] Minted ${amountFormatted} ${mapping.confidentialSymbol} to ${user}!`);
      console.log(`Mint Tx: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
    } catch (err: any) {
      console.error(`[ERROR] relayerMint failed:`, err.message || err);
    }
  }

  console.log("==================================================");
  console.log("All deposits processed successfully!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("Relayer worker error:", err);
  process.exitCode = 1;
});
