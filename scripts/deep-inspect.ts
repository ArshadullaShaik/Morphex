import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [signer] = await ethers.getSigners();
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const pairMatch = envContent.match(/VITE_PAIR_ADDRESS=(0x[a-fA-F0-9]+)/);
  const tokenListMatch = envContent.match(/VITE_TOKEN_LIST=(\[.*\])/);

  if (!pairMatch || !tokenListMatch) throw new Error("Missing config in frontend/.env.local");

  const pairAddress = pairMatch[1];
  const tokens = JSON.parse(tokenListMatch[1]);
  const usdcToken = tokens.find((t: any) => t.symbol === "cUSDC");
  const usdtToken = tokens.find((t: any) => t.symbol === "cUSDT");

  const pair = await ethers.getContractAt("ConfidentialPair", pairAddress, signer);
  const usdt = await ethers.getContractAt("MorphexToken", usdtToken.address, signer);
  const usdc = await ethers.getContractAt("MorphexToken", usdcToken.address, signer);

  console.log("==================================================");
  console.log("  Morphex — Deep Swap & Portfolio Inspector");
  console.log("==================================================");
  console.log(`Account: ${signer.address}`);

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`Current Block: ${currentBlock}`);

  const swapFilter = pair.filters.Swap();
  const events = await pair.queryFilter(swapFilter, Math.max(0, currentBlock - 50));
  console.log(`Recent swaps in last 50 blocks: ${events.length}`);
  for (const e of events) {
    const args = (e as any).args;
    console.log(`  - Block ${e.blockNumber}: trader=${args.trader} zeroForOne=${args.zeroForOne} tx=${e.transactionHash}`);
  }

  // 1. Decrypt last swap receipt
  const [inH, outH, succH] = await pair.lastSwapOf(signer.address);
  console.log("\nLast Swap Receipt Handles:");
  console.log("  in:  ", inH);
  console.log("  out: ", outH);
  console.log("  succ:", succH);

  // 2. Decrypt balances
  const usdtHandle = await usdt.confidentialBalanceOf(signer.address);
  const usdcHandle = await usdc.confidentialBalanceOf(signer.address);
  console.log("\nCurrent Balance Handles:");
  console.log("  cUSDT:", usdtHandle);
  console.log("  cUSDC:", usdcHandle);

  const instance = (fhevm as any)._fhevmEnv.instance;
  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const contractAddresses = [pairAddress, usdtToken.address, usdcToken.address];
  const eip712 = fhevm.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, 1);
  const { EIP712Domain: _domainType, ...signingTypes } = eip712.types;
  const signature = await signer.signTypedData(
    eip712.domain,
    signingTypes as unknown as Record<string, Array<{ name: string; type: string }>>,
    eip712.message,
  );

  const clearValues = await fhevm.userDecrypt(
    [
      { handle: inH, contractAddress: pairAddress },
      { handle: outH, contractAddress: pairAddress },
      { handle: succH, contractAddress: pairAddress },
      { handle: usdtHandle, contractAddress: usdtToken.address },
      { handle: usdcHandle, contractAddress: usdcToken.address },
    ],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    contractAddresses,
    signer.address,
    startTimestamp,
    1,
  );

  const getVal = (h: string) => {
    const k = Object.keys(clearValues).find((x) => x.toLowerCase() === h.toLowerCase());
    return k ? clearValues[k as `0x${string}`] : undefined;
  };

  console.log("\n==================================================");
  console.log("Decrypted Results from Sepolia:");
  console.log(`  Last Swap Success:  ${getVal(succH)}`);
  console.log(`  Last Swap In:       ${getVal(inH)}`);
  console.log(`  Last Swap Out:      ${getVal(outH)}`);
  console.log(`  Current cUSDT:      ${ethers.formatUnits(getVal(usdtHandle)?.toString() || "0", 6)}`);
  console.log(`  Current cUSDC:      ${ethers.formatUnits(getVal(usdcHandle)?.toString() || "0", 6)}`);
  console.log("==================================================");
}

main().catch(console.error);
