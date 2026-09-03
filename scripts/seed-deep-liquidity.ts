import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [deployer] = await ethers.getSigners();

  console.log("==================================================");
  console.log("  Morphex — Seed Deep AMM Pool Liquidity");
  console.log("==================================================");
  console.log(`Deployer: ${deployer.address}\n`);

  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const pairMatch = envContent.match(/VITE_PAIR_ADDRESS=(0x[a-fA-F0-9]+)/);
  const tokenListMatch = envContent.match(/VITE_TOKEN_LIST=(\[.*\])/);

  if (!pairMatch || !tokenListMatch) throw new Error("Missing config in frontend/.env.local");

  const pairAddress = pairMatch[1];
  const tokens = JSON.parse(tokenListMatch[1]);
  const usdcToken = tokens.find((t: any) => t.symbol === "cUSDC");
  const usdtToken = tokens.find((t: any) => t.symbol === "cUSDT");

  if (!usdcToken || !usdtToken) throw new Error("Tokens not found in config");

  const pair = await ethers.getContractAt("ConfidentialPair", pairAddress, deployer);
  const usdc = await ethers.getContractAt("MorphexToken", usdcToken.address, deployer);
  const usdt = await ethers.getContractAt("MorphexToken", usdtToken.address, deployer);

  // 500 tokens each (6 decimals = 500,000,000 units)
  const LIQUIDITY_AMOUNT = 500_000_000n; // 500 tokens

  console.log(`Pair:         ${pairAddress}`);
  console.log(`Token0 cUSDC: ${usdcToken.address}`);
  console.log(`Token1 cUSDT: ${usdtToken.address}`);
  console.log(`Adding:       500 cUSDC + 500 cUSDT (500 LP shares)\n`);

  // 1. Set Operator sequentially to ensure clean nonces
  const expiry = Math.floor(Date.now() / 1000) + 86_400;
  console.log("Setting pair operator for cUSDC...");
  const opTx1 = await usdc.setOperator(pairAddress, expiry);
  await opTx1.wait();
  console.log("Setting pair operator for cUSDT...");
  const opTx2 = await usdt.setOperator(pairAddress, expiry);
  await opTx2.wait();
  console.log("Operator permissions confirmed.");

  // 2. Encrypt inputs
  console.log("Creating encrypted inputs for 500 tokens...");
  const [enc0, enc1, encShares] = await Promise.all([
    fhevm.createEncryptedInput(pairAddress, deployer.address).add64(LIQUIDITY_AMOUNT).encrypt(),
    fhevm.createEncryptedInput(pairAddress, deployer.address).add64(LIQUIDITY_AMOUNT).encrypt(),
    fhevm.createEncryptedInput(pairAddress, deployer.address).add64(LIQUIDITY_AMOUNT).encrypt(),
  ]);

  // 3. Call addLiquidity
  console.log("Calling addLiquidity on ConfidentialPair...");
  const tx = await pair.addLiquidity(
    enc0.handles[0],
    enc1.handles[0],
    encShares.handles[0],
    enc0.inputProof,
    enc1.inputProof,
    encShares.inputProof,
  );
  console.log(`Submitted tx: ${tx.hash}`);
  console.log("Waiting for confirmation on Sepolia...");
  await tx.wait();

  console.log("\n[SUCCESS] Seeded 500 cUSDC + 500 cUSDT deep liquidity into the pair!");
  console.log(`Tx: https://sepolia.etherscan.io/tx/${tx.hash}`);
}

main().catch((err) => {
  console.error("Seed liquidity error:", err);
  process.exitCode = 1;
});
