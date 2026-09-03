import { ethers } from "hardhat";

async function main() {
  const txHash = "0x0b47daa4d00a7a8d50617af277c75fb7f02d7bcf9e4dd9b0ed0b5d30f8740bb5";
  const tx = await ethers.provider.getTransaction(txHash);
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  console.log("Tx details:");
  console.log("  To:      ", tx?.to);
  console.log("  From:    ", tx?.from);
  console.log("  GasUsed: ", receipt?.gasUsed.toString());
  console.log("  Status:  ", receipt?.status);
  console.log("  Logs:    ", receipt?.logs.length);
}

main().catch(console.error);
