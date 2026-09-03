import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [signer] = await ethers.getSigners();

  console.log("==================================================");
  console.log("  Morphex — Live Confidential Swap Test (Sepolia)");
  console.log("==================================================");
  console.log(`Trader: ${signer.address}\n`);

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

  // Swap 5 cUSDT for 4.90 cUSDC (factoring in AMM price impact on 500 reserve + fee)
  const amountIn = 5_000_000n; // 5.0 USDT
  const amountOutTarget = 4_900_000n; // 4.90 USDC

  console.log(`Swapping: 5.0 cUSDT -> Target: 4.90 cUSDC`);
  console.log(`Pair:     ${pairAddress}\n`);

  // 1. Set Operator
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  console.log("Setting pair operator on cUSDT...");
  const opTx = await usdt.setOperator(pairAddress, expiry);
  await opTx.wait();

  // 2. Encrypt input and output target
  console.log("Encrypting swap input and output targets...");
  const [encIn, encOut] = await Promise.all([
    fhevm.createEncryptedInput(pairAddress, signer.address).add64(amountIn).encrypt(),
    fhevm.createEncryptedInput(pairAddress, signer.address).add64(amountOutTarget).encrypt(),
  ]);

  // Direction: pair.token0 is cUSDC, so selling cUSDT (token1) is zeroForOne = false
  const token0 = await pair.token0();
  const zeroForOne = token0.toLowerCase() === usdtToken.address.toLowerCase();
  console.log(`Direction (zeroForOne): ${zeroForOne}`);

  // 3. Submit swapExactInput
  console.log("Submitting swapExactInput to ConfidentialPair...");
  const swapTx = await pair.swapExactInput(
    zeroForOne,
    encIn.handles[0],
    encOut.handles[0],
    encIn.inputProof,
    encOut.inputProof,
  );
  console.log(`Submitted tx: ${swapTx.hash}`);
  console.log("Waiting for confirmation on Sepolia...");
  await swapTx.wait();

  console.log("\n[SUCCESS] Swap transaction confirmed on Sepolia!");
  console.log(`Tx: https://sepolia.etherscan.io/tx/${swapTx.hash}`);

  // 4. Decrypt last swap receipt
  console.log("\nDecrypting swap receipt to verify execution...");
  const [amountInHandle, amountOutHandle, successHandle] = await pair.lastSwapOf(signer.address);

  const instance = (fhevm as any)._fhevmEnv.instance;
  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const eip712 = fhevm.createEIP712(keypair.publicKey, [pairAddress], startTimestamp, 1);
  const { EIP712Domain: _domainType, ...signingTypes } = eip712.types;
  const signature = await signer.signTypedData(
    eip712.domain,
    signingTypes as unknown as Record<string, Array<{ name: string; type: string }>>,
    eip712.message,
  );

  const clearValues = await fhevm.userDecrypt(
    [
      { handle: amountInHandle, contractAddress: pairAddress },
      { handle: amountOutHandle, contractAddress: pairAddress },
      { handle: successHandle, contractAddress: pairAddress },
    ],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    [pairAddress],
    signer.address,
    startTimestamp,
    1,
  );

  const formatHandle = (h: string) => {
    const k = Object.keys(clearValues).find((x) => x.toLowerCase() === h.toLowerCase());
    return k ? clearValues[k as `0x${string}`] : undefined;
  };

  const executedSuccess = formatHandle(successHandle);
  const actualIn = formatHandle(amountInHandle);
  const actualOut = formatHandle(amountOutHandle);

  console.log("\nReceipt Result:");
  console.log(`  Swap Success: ${executedSuccess}`);
  console.log(`  Amount In:    ${actualIn ? ethers.formatUnits(actualIn.toString(), 6) : "0"} cUSDT`);
  console.log(`  Amount Out:   ${actualOut ? ethers.formatUnits(actualOut.toString(), 6) : "0"} cUSDC`);
}

main().catch((err) => {
  console.error("Test swap error:", err);
  process.exitCode = 1;
});
