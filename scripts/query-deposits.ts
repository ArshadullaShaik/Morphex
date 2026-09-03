import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const vaultMatch = envContent.match(/VITE_RELAYER_VAULT_ADDRESS=(0x[a-fA-F0-9]+)/);
  if (!vaultMatch) throw new Error("No vault address");
  const vaultAddr = vaultMatch[1];
  const vault = await ethers.getContractAt("RelayerVault", vaultAddr);
  const currentBlock = await ethers.provider.getBlockNumber();
  const filter = vault.filters.Deposited();
  const events = await vault.queryFilter(filter, currentBlock - 500);

  console.log(`Current block: ${currentBlock}`);
  console.log(`Vault Deposited events found: ${events.length}`);
  for (const e of events) {
    const args = (e as any).args;
    console.log({
      user: args.user,
      token: args.token,
      amount: ethers.formatUnits(args.amount, 6),
      tx: e.transactionHash,
    });
  }
}

main().catch(console.error);
