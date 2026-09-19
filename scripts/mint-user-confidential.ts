import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  await fhevm.initializeCLIApi();
  const [signer] = await ethers.getSigners();

  const recipient = process.env.RECIPIENT || "0x00ea78522B3192f9b766795EcBF1030970aBBeb9";
  const amountNumber = Number(process.env.AMOUNT || "500");
  const amountUnits = BigInt(amountNumber) * 1_000_000n; // 6 decimals

  console.log("==================================================");
  console.log("  Morphex — Direct Confidential Token Mint");
  console.log("==================================================");
  console.log(`Signer:    ${signer.address}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Amount:    ${amountNumber} cUSDT & ${amountNumber} cUSDC\n`);

  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const tokenListMatch = envContent.match(/VITE_TOKEN_LIST=(\[.*\])/);
  if (!tokenListMatch) throw new Error("VITE_TOKEN_LIST not found in frontend/.env.local");

  const tokens = JSON.parse(tokenListMatch[1]);
  const cUSDT = tokens.find((t: any) => t.symbol === "cUSDT");
  const cUSDC = tokens.find((t: any) => t.symbol === "cUSDC");

  if (!cUSDT || !cUSDC) throw new Error("cUSDT or cUSDC address not found");

  for (const token of [cUSDT, cUSDC]) {
    console.log(`Processing ${token.symbol} (${token.address})...`);
    const contract = await ethers.getContractAt("MorphexToken", token.address, signer);

    const isOwner = (await contract.owner()).toLowerCase() === signer.address.toLowerCase();
    const isRelayer = await contract.hasRole(await contract.RELAYER_ROLE(), signer.address);

    if (!isOwner && !isRelayer) {
      console.error(`  [ERROR] Signer ${signer.address} is neither owner nor relayer for ${token.symbol}!`);
      continue;
    }

    console.log(`  Encrypting ${amountNumber} units for ${recipient}...`);
    const input = fhevm.createEncryptedInput(token.address, recipient);
    input.add64(amountUnits);
    const encrypted = await input.encrypt();

    let tx;
    if (isOwner) {
      console.log(`  Calling mint() as owner...`);
      tx = await contract.mint(recipient, encrypted.handles[0], encrypted.inputProof);
    } else {
      console.log(`  Calling relayerMint() as relayer...`);
      tx = await contract.relayerMint(recipient, encrypted.handles[0], encrypted.inputProof);
    }

    console.log(`  Submitted tx: ${tx.hash}`);
    await tx.wait();
    console.log(`  [OK] Successfully minted ${amountNumber} ${token.symbol} to ${recipient}!\n`);
  }

  console.log("Confidential mint complete!");
}

main().catch((err) => {
  console.error("Mint error:", err);
  process.exitCode = 1;
});
