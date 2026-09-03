import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [relayer] = await ethers.getSigners();
  const requestId = BigInt(process.env.REQUEST_ID || "1");

  console.log("==================================================");
  console.log("  Morphex — Fulfill Withdrawal Request");
  console.log("==================================================");
  console.log(`Relayer:    ${relayer.address}`);
  console.log(`Request ID: #${requestId}\n`);

  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const vaultMatch = envContent.match(/VITE_RELAYER_VAULT_ADDRESS=(0x[a-fA-F0-9]+)/);
  if (!vaultMatch) throw new Error("No vault");
  const vault = await ethers.getContractAt("RelayerVault", vaultMatch[1], relayer);

  const req = await vault.withdrawalRequests(requestId);
  if (req.user === ethers.ZeroAddress) {
    throw new Error(`Request #${requestId} does not exist`);
  }
  if (req.fulfilled) {
    console.log(`Request #${requestId} is already fulfilled.`);
    return;
  }

  console.log(`User:      ${req.user}`);
  console.log(`Token:     ${req.token}`);
  console.log(`Amount:    ${ethers.formatUnits(req.amount, 6)}`);

  console.log("\nCalling batchWithdraw on RelayerVault...");
  const payout = {
    recipient: req.user,
    token: req.token,
    amount: req.amount,
  };

  const tx = await vault.batchWithdraw([payout], [requestId]);
  console.log(`Submitted tx: ${tx.hash}`);
  console.log("Waiting for confirmation on Sepolia...");
  await tx.wait();

  console.log("\n[SUCCESS] Withdrawal fulfilled!");
  console.log(`Tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
  console.log(`The user (${req.user}) has received ${ethers.formatUnits(req.amount, 6)} USDT.`);
}

main().catch((err) => {
  console.error("Fulfill error:", err);
  process.exitCode = 1;
});
