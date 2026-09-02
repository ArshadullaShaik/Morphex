import { ethers, fhevm } from "hardhat";

async function main() {
  const tokenAddress = process.env.MORPHEX_TOKEN_ADDRESS;
  const recipient = process.env.MORPHEX_RECIPIENT;
  const amount = process.env.MORPHEX_AMOUNT;
  if (!tokenAddress || !recipient || !amount) {
    throw new Error("Set MORPHEX_TOKEN_ADDRESS, MORPHEX_RECIPIENT, and MORPHEX_AMOUNT");
  }

  await fhevm.initializeCLIApi();
  const [owner] = await ethers.getSigners();
  const token = await ethers.getContractAt("MorphexToken", tokenAddress, owner);
  const input = fhevm.createEncryptedInput(tokenAddress, recipient).add64(BigInt(amount));
  const encrypted = await input.encrypt();
  await (await token.mint(recipient, encrypted.handles[0], encrypted.inputProof)).wait();
  console.log(`Minted encrypted ${amount} units to ${recipient}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});