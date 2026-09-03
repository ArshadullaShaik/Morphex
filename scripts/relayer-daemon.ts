import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

const PROCESSED_FILE = ".relayer-processed.json";

async function loadProcessed(): Promise<Record<string, boolean>> {
  try {
    const data = await fs.readFile(PROCESSED_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {
      // Mark initial deposit #1 as already processed
      "0xbcc1d55a623160e3a73acdbdb793c97952c379800583939eaee958631b20ed98": true,
    };
  }
}

async function saveProcessed(processed: Record<string, boolean>) {
  await fs.writeFile(PROCESSED_FILE, JSON.stringify(processed, null, 2));
}

async function main() {
  await fhevm.initializeCLIApi();
  const [relayer] = await ethers.getSigners();

  console.log("==================================================");
  console.log("  Morphex — Automatic Relayer Service Daemon");
  console.log("==================================================");
  console.log(`Relayer: ${relayer.address}`);

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

  const processed = await loadProcessed();

  console.log(`Watching RelayerVault at: ${vaultAddress}`);
  console.log("Listening for new deposits on Sepolia...\n");

  const processLoop = async () => {
    try {
      const currentBlock = await ethers.provider.getBlockNumber();
      const filter = vault.filters.Deposited();
      const events = await vault.queryFilter(filter, Math.max(0, currentBlock - 500));

      for (const e of events) {
        const txHash = e.transactionHash;
        if (processed[txHash]) continue;

        const { user, token, amount } = (e as any).args;
        const mapping = tokenMap.get(token.toLowerCase());

        if (!mapping) {
          console.warn(`[SKIP] No wrapper found for token ${token}`);
          processed[txHash] = true;
          await saveProcessed(processed);
          continue;
        }

        const amountFormatted = ethers.formatUnits(amount, 6);
        console.log(`\n>>> New Deposit Detected! <<<`);
        console.log(`  Tx:     https://sepolia.etherscan.io/tx/${txHash}`);
        console.log(`  User:   ${user}`);
        console.log(`  Amount: ${amountFormatted} ${mapping.publicSymbol}`);

        const cTokenContract = await ethers.getContractAt("MorphexToken", mapping.confidentialAddress, relayer);

        console.log(`  Generating FHE encryption for ${user}...`);
        const input = fhevm.createEncryptedInput(mapping.confidentialAddress, user);
        input.add64(BigInt(amount));
        const encrypted = await input.encrypt();

        console.log(`  Calling relayerMint on ${mapping.confidentialSymbol}...`);
        const tx = await cTokenContract.relayerMint(user, encrypted.handles[0], encrypted.inputProof);
        console.log(`  Submitted relayerMint tx: ${tx.hash}`);
        await tx.wait();

        processed[txHash] = true;
        await saveProcessed(processed);
        console.log(`  [SUCCESS] Minted ${amountFormatted} ${mapping.confidentialSymbol} to ${user}!`);
        console.log(`  Mint Tx: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
      }

      // 2. Check and process pending Withdrawal Requests
      const withdrawalFilter = vault.filters.WithdrawalRequested();
      const withdrawalEvents = await vault.queryFilter(withdrawalFilter, Math.max(0, currentBlock - 500));

      for (const e of withdrawalEvents) {
        const { user, requestId, token, amount } = (e as any).args;
        const key = `withdrawal_${requestId.toString()}`;
        if (processed[key]) continue;

        const req = await vault.withdrawalRequests(requestId);
        if (req.fulfilled) {
          processed[key] = true;
          await saveProcessed(processed);
          continue;
        }

        const amountFormatted = ethers.formatUnits(amount, 6);
        console.log(`\n>>> New Withdrawal Request #${requestId} Detected! <<<`);
        console.log(`  User:   ${user}`);
        console.log(`  Amount: ${amountFormatted}`);

        console.log(`  Calling batchWithdraw on RelayerVault...`);
        const payout = { recipient: user, token, amount };
        const tx = await vault.batchWithdraw([payout], [requestId]);
        console.log(`  Submitted batchWithdraw tx: ${tx.hash}`);
        await tx.wait();

        processed[key] = true;
        await saveProcessed(processed);
        console.log(`  [SUCCESS] Paid out ${amountFormatted} tokens to ${user}!`);
        console.log(`  Payout Tx: https://sepolia.etherscan.io/tx/${tx.hash}\n`);
      }
    } catch (err: any) {
      console.error("  [ERROR during polling]:", err.message || err);
    }
  };

  // Run immediately
  await processLoop();

  // If running as continuous daemon (DAEMON=1 or default in npm run relayer:daemon)
  if (process.env.ONCE !== "1") {
    console.log("Relayer daemon is active. Polling every 12 seconds for new deposits and withdrawals...");
    setInterval(processLoop, 12_000);
  }
}

main().catch((err) => {
  console.error("Relayer daemon fatal error:", err);
  process.exitCode = 1;
});
