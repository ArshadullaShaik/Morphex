import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [signer] = await ethers.getSigners();
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const pairMatch = envContent.match(/VITE_PAIR_ADDRESS=(0x[a-fA-F0-9]+)/);
  const tokenListMatch = envContent.match(/VITE_TOKEN_LIST=(\[.*\])/);

  if (!pairMatch || !tokenListMatch) throw new Error("Missing config");

  const pairAddress = pairMatch[1];
  const tokens = JSON.parse(tokenListMatch[1]);
  const usdcToken = tokens.find((t: any) => t.symbol === "cUSDC");
  const usdtToken = tokens.find((t: any) => t.symbol === "cUSDT");

  const pair = await ethers.getContractAt("ConfidentialPair", pairAddress, signer);
  const usdt = await ethers.getContractAt("MorphexToken", usdtToken.address, signer);

  // Swap 5 cUSDT for 4.60 cUSDC (safe 5% buffer)
  const amountIn = 5_000_000n; // 5.0 USDT
  const amountOutTarget = 4_600_000n; // 4.60 USDC

  console.log("Setting operator...");
  const opTx = await usdt.setOperator(pairAddress, Math.floor(Date.now() / 1000) + 3600);
  await opTx.wait();

  console.log("Encrypting swap inputs (5 cUSDT -> 4.60 cUSDC)...");
  const [encIn, encOut] = await Promise.all([
    fhevm.createEncryptedInput(pairAddress, signer.address).add64(amountIn).encrypt(),
    fhevm.createEncryptedInput(pairAddress, signer.address).add64(amountOutTarget).encrypt(),
  ]);

  const token0 = await pair.token0();
  const zeroForOne = token0.toLowerCase() === usdtToken.address.toLowerCase();
  console.log(`Submitting swapExactInput (zeroForOne: ${zeroForOne})...`);
  const tx = await pair.swapExactInput(
    zeroForOne,
    encIn.handles[0],
    encOut.handles[0],
    encIn.inputProof,
    encOut.inputProof,
  );
  console.log(`Submitted tx: ${tx.hash}`);
  await tx.wait();
  console.log("Tx confirmed!");

  console.log("Decrypting last swap receipt...");
  const [inH, outH, succH] = await pair.lastSwapOf(signer.address);

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
      { handle: inH, contractAddress: pairAddress },
      { handle: outH, contractAddress: pairAddress },
      { handle: succH, contractAddress: pairAddress },
    ],
    keypair.privateKey,
    keypair.publicKey,
    signature,
    [pairAddress],
    signer.address,
    startTimestamp,
    1,
  );

  const getVal = (h: string) => {
    const k = Object.keys(clearValues).find((x) => x.toLowerCase() === h.toLowerCase());
    return k ? clearValues[k as `0x${string}`] : undefined;
  };

  console.log("Receipt results:");
  console.log("  Success: ", getVal(succH));
  console.log("  In:      ", getVal(inH));
  console.log("  Out:     ", getVal(outH));
}

main().catch(console.error);
