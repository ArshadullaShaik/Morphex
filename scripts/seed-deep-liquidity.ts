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
  console.log(`Token cUSDC:  ${usdcToken.address}`);
  console.log(`Token cUSDT:  ${usdtToken.address}`);
  console.log(`Target:       500 cUSDC + 500 cUSDT (500 LP shares)\n`);

  // 1. Mint 500 cUSDC and 500 cUSDT to deployer first
  console.log("Minting 500 cUSDC to deployer...");
  const encMintUSDC = await fhevm
    .createEncryptedInput(usdcToken.address, deployer.address)
    .add64(LIQUIDITY_AMOUNT)
    .encrypt();
  const txMintUSDC = await usdc.mint(deployer.address, encMintUSDC.handles[0], encMintUSDC.inputProof);
  console.log(`  Sent mint cUSDC tx: ${txMintUSDC.hash}`);
  await txMintUSDC.wait();
  console.log("  [OK] 500 cUSDC minted to deployer.\n");

  console.log("Minting 500 cUSDT to deployer...");
  const encMintUSDT = await fhevm
    .createEncryptedInput(usdtToken.address, deployer.address)
    .add64(LIQUIDITY_AMOUNT)
    .encrypt();
  const txMintUSDT = await usdt.mint(deployer.address, encMintUSDT.handles[0], encMintUSDT.inputProof);
  console.log(`  Sent mint cUSDT tx: ${txMintUSDT.hash}`);
  await txMintUSDT.wait();
  console.log("  [OK] 500 cUSDT minted to deployer.\n");

  // 2. Set Operator sequentially
  const expiry = Math.floor(Date.now() / 1000) + 86_400;
  console.log("Setting pair operator for cUSDC...");
  const opTx1 = await usdc.setOperator(pairAddress, expiry);
  await opTx1.wait();
  console.log("Setting pair operator for cUSDT...");
  const opTx2 = await usdt.setOperator(pairAddress, expiry);
  await opTx2.wait();
  console.log("Operator permissions confirmed.\n");

  // 3. Encrypt inputs for addLiquidity
  console.log("Creating encrypted inputs for 500 tokens on pair...");
  const [enc0, enc1, encShares] = await Promise.all([
    fhevm.createEncryptedInput(pairAddress, deployer.address).add64(LIQUIDITY_AMOUNT).encrypt(),
    fhevm.createEncryptedInput(pairAddress, deployer.address).add64(LIQUIDITY_AMOUNT).encrypt(),
    fhevm.createEncryptedInput(pairAddress, deployer.address).add64(LIQUIDITY_AMOUNT).encrypt(),
  ]);

  // 4. Call addLiquidity
  console.log("Calling addLiquidity on ConfidentialPair...");
  const tx = await pair.addLiquidity(
    enc0.handles[0],
    enc1.handles[0],
    encShares.handles[0],
    enc0.inputProof,
    enc1.inputProof,
    encShares.inputProof,
  );
  console.log(`Submitted addLiquidity tx: ${tx.hash}`);
  console.log("Waiting for confirmation on Sepolia...");
  await tx.wait();

  console.log("\n[SUCCESS] Seeded 500 cUSDC + 500 cUSDT deep liquidity into the pair!");
  console.log(`Tx: https://sepolia.etherscan.io/tx/${tx.hash}\n`);

  // 5. Decrypt receipt to verify
  console.log("Decrypting liquidity receipt to verify on-chain state...");
  const [a0Handle, a1Handle, sharesHandle, successHandle] = await pair.lastLiquidityOf(deployer.address);
  const instance = (fhevm as any)._fhevmEnv.instance;
  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const eip712 = fhevm.createEIP712(keypair.publicKey, [pairAddress], startTimestamp, 1);
  const { EIP712Domain: _domainType, ...signingTypes } = eip712.types;
  const signature = await deployer.signTypedData(
    eip712.domain,
    signingTypes as unknown as Record<string, Array<{ name: string; type: string }>>,
    eip712.message,
  );
  const clearValues = await fhevm.userDecrypt(
    [
      { handle: a0Handle, contractAddress: pairAddress },
      { handle: a1Handle, contractAddress: pairAddress },
      { handle: sharesHandle, contractAddress: pairAddress },
      { handle: successHandle, contractAddress: pairAddress },
    ],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    [pairAddress],
    deployer.address,
    startTimestamp,
    1,
  );

  const getVal = (h: string) => {
    const k = Object.keys(clearValues).find((x) => x.toLowerCase() === h.toLowerCase());
    return k ? clearValues[k as `0x${string}`] : undefined;
  };

  console.log("Decrypted Liquidity Receipt:");
  console.log(`  Success:       ${getVal(successHandle)}`);
  console.log(`  Accepted 0:    ${ethers.formatUnits(getVal(a0Handle)?.toString() || "0", 6)} tokens`);
  console.log(`  Accepted 1:    ${ethers.formatUnits(getVal(a1Handle)?.toString() || "0", 6)} tokens`);
  console.log(`  Minted Shares: ${ethers.formatUnits(getVal(sharesHandle)?.toString() || "0", 6)} shares`);
}

main().catch((err) => {
  console.error("Seed liquidity error:", err);
  process.exitCode = 1;
});
