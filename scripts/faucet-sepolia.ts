import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [signer] = await ethers.getSigners();

  const recipient = process.env.RECIPIENT || signer.address;
  const amountUnits = BigInt(process.env.AMOUNT || "1000") * 1_000_000n; // 6 decimals

  console.log("==================================================");
  console.log("  Morphex Sepolia Testnet Faucet");
  console.log("==================================================");
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount:    ${amountUnits / 1_000_000n} tokens\n`);

  // Load deployed configuration
  let tokenList: Array<{ name: string; symbol: string; address: string }> = [];
  let publicList: Array<{ name: string; symbol: string; address: string }> = [];

  try {
    const envFile = await fs.readFile("frontend/.env.local", "utf8");
    const tokenLine = envFile.split("\n").find((line) => line.startsWith("VITE_TOKEN_LIST="));
    const publicLine = envFile.split("\n").find((line) => line.startsWith("VITE_PUBLIC_TOKEN_LIST="));

    if (tokenLine) {
      tokenList = JSON.parse(tokenLine.replace("VITE_TOKEN_LIST=", ""));
    }
    if (publicLine) {
      publicList = JSON.parse(publicLine.replace("VITE_PUBLIC_TOKEN_LIST=", ""));
    }
  } catch {
    console.warn("Could not read frontend/.env.local. Make sure contracts are deployed first.");
  }

  // 1. Mint public mock tokens if available
  if (publicList.length > 0) {
    console.log("Minting public mock ERC-20 tokens...");
    for (const token of publicList) {
      try {
        const mockContract = await ethers.getContractAt("MockERC20", token.address, signer);
        const tx = await mockContract.mint(recipient, amountUnits);
        await tx.wait();
        console.log(`  [OK] Minted ${amountUnits / 1_000_000n} ${token.symbol} (Public) -> tx: ${tx.hash}`);
      } catch (err: any) {
        console.warn(`  [SKIP] Could not mint public ${token.symbol}: ${err.message || err}`);
      }
    }
  }

  // 2. Mint confidential tokens (MorphexToken)
  if (tokenList.length > 0) {
    console.log("\nMinting encrypted confidential tokens (cTokens)...");
    for (const token of tokenList) {
      try {
        const confidential = await ethers.getContractAt("MorphexToken", token.address, signer);
        const input = fhevm.createEncryptedInput(token.address, recipient);
        input.add64(amountUnits);
        const encrypted = await input.encrypt();
        const tx = await confidential.mint(recipient, encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
        console.log(`  [OK] Minted ${amountUnits / 1_000_000n} ${token.symbol} (Confidential) -> tx: ${tx.hash}`);
      } catch (err: any) {
        console.warn(`  [SKIP] Could not mint confidential ${token.symbol}: ${err.message || err}`);
      }
    }
  }

  console.log("\nFaucet minting completed successfully!");
}

main().catch((error) => {
  console.error("Faucet error:", error);
  process.exitCode = 1;
});
