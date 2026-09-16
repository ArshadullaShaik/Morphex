import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [signer] = await ethers.getSigners();
  const recipient = process.env.RECIPIENT || signer.address;

  console.log("==================================================");
  console.log("  Morphex — Mint Specific Tokens");
  console.log("==================================================");
  console.log(`Signer (Deployer): ${signer.address}`);
  console.log(`Recipient:         ${recipient}\n`);

  const usdtAddress = "0x4b29D03952F15D89EB458aF461b55C51faCE1357";
  const usdcAddress = "0xc0500be2602B03BE6a5bb97Ae0f052C6fBA7C0D3";

  const usdtAmount = 1000n * 1_000_000n; // 1000 USDT (6 decimals)
  const usdcAmount = 100n * 1_000_000n;  // 100 USDC (6 decimals)

  const mockAbi = [
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address account) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ];

  // 1. Mint USDT
  console.log(`Minting 1,000 USDT to ${recipient}...`);
  const usdt = new ethers.Contract(usdtAddress, mockAbi, signer);
  const tx1 = await usdt.mint(recipient, usdtAmount);
  console.log(`  -> Sent tx: ${tx1.hash}. Waiting for confirmation...`);
  await tx1.wait();
  const bal1 = await usdt.balanceOf(recipient);
  console.log(`  [OK] Confirmed! New USDT Balance: ${ethers.formatUnits(bal1, 6)} USDT\n`);

  // 2. Mint USDC
  console.log(`Minting 100 USDC to ${recipient}...`);
  const usdc = new ethers.Contract(usdcAddress, mockAbi, signer);
  const tx2 = await usdc.mint(recipient, usdcAmount);
  console.log(`  -> Sent tx: ${tx2.hash}. Waiting for confirmation...`);
  await tx2.wait();
  const bal2 = await usdc.balanceOf(recipient);
  console.log(`  [OK] Confirmed! New USDC Balance: ${ethers.formatUnits(bal2, 6)} USDC\n`);

  console.log("Tokens minted successfully!");
}

main().catch((err) => {
  console.error("Mint error:", err);
  process.exitCode = 1;
});
