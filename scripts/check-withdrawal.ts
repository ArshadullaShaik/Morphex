import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [signer] = await ethers.getSigners();
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const vaultMatch = envContent.match(/VITE_RELAYER_VAULT_ADDRESS=(0x[a-fA-F0-9]+)/);
  if (!vaultMatch) throw new Error("No vault");
  const vault = await ethers.getContractAt("RelayerVault", vaultMatch[1], signer);

  const req = await vault.withdrawalRequests(1);
  console.log("Withdrawal Request #1:");
  console.log(`  User:        ${req.user}`);
  console.log(`  Token:       ${req.token}`);
  console.log(`  Amount:      ${ethers.formatUnits(req.amount, 6)}`);
  console.log(`  Fulfilled:   ${req.fulfilled}`);
  console.log(`  RequestedAt: ${new Date(Number(req.requestedAt) * 1000).toISOString()}`);
  console.log(`  Delay:       ${await vault.ESCAPE_HATCH_DELAY()} seconds`);
}

main().catch(console.error);
