import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [signer] = await ethers.getSigners();
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const tokenMatch = envContent.match(/VITE_TOKEN_LIST=(\[.*\])/);
  if (!tokenMatch) throw new Error("No token list");
  const tokens = JSON.parse(tokenMatch[1]);

  console.log("Checking confidential balance handles for:", signer.address);

  for (const token of tokens) {
    const contract = await ethers.getContractAt("MorphexToken", token.address, signer);
    const handle = await contract.confidentialBalanceOf(signer.address);
    console.log(`Token: ${token.symbol} (${token.address})`);
    console.log(`  Handle: ${handle}`);
    const isZero = /^0x0{64}$/i.test(handle);
    console.log(`  Has non-zero encrypted handle: ${!isZero}`);
  }
}

main().catch(console.error);
