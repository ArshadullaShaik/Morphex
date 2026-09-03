import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [signer] = await ethers.getSigners();
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const pairMatch = envContent.match(/VITE_PAIR_ADDRESS=(0x[a-fA-F0-9]+)/);
  if (!pairMatch) throw new Error("No pair address");
  const pairAddress = pairMatch[1];
  const pair = await ethers.getContractAt("ConfidentialPair", pairAddress, signer);

  const [amountInHandle, amountOutHandle, successHandle] = await pair.lastSwapOf(signer.address);

  console.log("Decrypting last swap receipt for", signer.address);
  console.log("  amountIn handle: ", amountInHandle);
  console.log("  amountOut handle:", amountOutHandle);
  console.log("  success handle:  ", successHandle);

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

  console.log("\nDecrypted Swap Receipt Values:");
  for (const [h, val] of Object.entries(clearValues)) {
    console.log(`  ${h}: ${val}`);
  }
}

main().catch(console.error);
