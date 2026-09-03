import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [signer] = await ethers.getSigners();
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const pairMatch = envContent.match(/VITE_PAIR_ADDRESS=(0x[a-fA-F0-9]+)/);
  if (!pairMatch) throw new Error("No pair address");
  const pairAddress = pairMatch[1];
  const pair = await ethers.getContractAt("ConfidentialPair", pairAddress, signer);

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);

  const swapFilter = pair.filters.Swap();
  const swapEvents = await pair.queryFilter(swapFilter, Math.max(0, currentBlock - 300));
  console.log(`Found ${swapEvents.length} Swap events in the last 300 blocks:`);
  for (const e of swapEvents) {
    const args = (e as any).args;
    console.log(`  - Block ${e.blockNumber}: trader=${args.trader}, zeroForOne=${args.zeroForOne}, tx=${e.transactionHash}`);
  }

  // Check lastSwapOf
  const [inH, outH, succH] = await pair.lastSwapOf(signer.address);
  console.log("\nLast swap handles for", signer.address);
  console.log("  in:  ", inH);
  console.log("  out: ", outH);
  console.log("  succ:", succH);
}

main().catch(console.error);
