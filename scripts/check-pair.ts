import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [signer] = await ethers.getSigners();
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const pairMatch = envContent.match(/VITE_PAIR_ADDRESS=(0x[a-fA-F0-9]+)/);
  if (!pairMatch) throw new Error("No pair address");
  const pairAddress = pairMatch[1];

  console.log("==================================================");
  console.log("  Morphex — Inspect ConfidentialPair on Sepolia");
  console.log("==================================================");
  console.log(`Pair: ${pairAddress}`);

  const pair = await ethers.getContractAt("ConfidentialPair", pairAddress, signer);

  const token0 = await pair.token0();
  const token1 = await pair.token1();
  console.log(`Token0: ${token0}`);
  console.log(`Token1: ${token1}`);

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);

  // Query Swap events
  const swapFilter = pair.filters.Swap();
  const swapEvents = await pair.queryFilter(swapFilter, Math.max(0, currentBlock - 500));

  console.log(`Swap events found: ${swapEvents.length}`);
  for (const e of swapEvents) {
    const args = (e as any).args;
    console.log(`  - Swap by ${args.trader} (zeroForOne: ${args.zeroForOne}) in tx ${e.transactionHash}`);
  }

  // Check lastSwapOf for signer
  const lastReceipt = await pair.lastSwapOf(signer.address);
  console.log("\nLast Swap Receipt for", signer.address, ":");
  console.log("  amountIn handle: ", lastReceipt[0]);
  console.log("  amountOut handle:", lastReceipt[1]);
  console.log("  success handle:  ", lastReceipt[2]);
}

main().catch(console.error);
