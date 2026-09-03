import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [signer] = await ethers.getSigners();
  const amountStr = process.env.AMOUNT || "100"; // default: 100 USDT
  const amount = ethers.parseUnits(amountStr, 6);

  console.log("==================================================");
  console.log("  Morphex — Deposit Public USDT to RelayerVault");
  console.log("==================================================");
  console.log(`Depositor: ${signer.address}`);
  console.log(`Amount:    ${amountStr} USDT\n`);

  // Read addresses from frontend/.env.local
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const vaultLine = envContent.split("\n").find((l) => l.startsWith("VITE_RELAYER_VAULT_ADDRESS="));
  const publicTokensLine = envContent.split("\n").find((l) => l.startsWith("VITE_PUBLIC_TOKEN_LIST="));

  if (!vaultLine || !publicTokensLine) {
    throw new Error("Could not read addresses from frontend/.env.local");
  }

  const vaultAddress = vaultLine.replace("VITE_RELAYER_VAULT_ADDRESS=", "").trim();
  const publicTokens = JSON.parse(publicTokensLine.replace("VITE_PUBLIC_TOKEN_LIST=", "").trim());
  const usdtToken = publicTokens.find((t: any) => t.symbol === "USDT");

  if (!usdtToken) {
    throw new Error("USDT token not found in public token list");
  }

  console.log(`USDT Contract:  ${usdtToken.address}`);
  console.log(`Vault Contract: ${vaultAddress}\n`);

  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
  ];
  const vaultAbi = [
    "function deposit(address token, uint256 amount)",
  ];

  const usdtContract = new ethers.Contract(usdtToken.address, erc20Abi, signer);
  const vaultContract = new ethers.Contract(vaultAddress, vaultAbi, signer);

  // 1. Check balance
  const balance = await usdtContract.balanceOf(signer.address);
  console.log(`Your public USDT balance: ${ethers.formatUnits(balance, 6)} USDT`);

  if (balance < amount) {
    console.log(`\nInsufficient USDT! Minting ${amountStr} USDT via faucet first...`);
    const mockContract = await ethers.getContractAt("MockERC20", usdtToken.address, signer);
    const mintTx = await mockContract.mint(signer.address, amount);
    await mintTx.wait();
    console.log(`Minted ${amountStr} USDT. Tx: ${mintTx.hash}`);
  }

  // 2. Approve Vault
  const allowance = await usdtContract.allowance(signer.address, vaultAddress);
  if (allowance < amount) {
    console.log("\nApproving RelayerVault to transfer USDT...");
    const approveTx = await usdtContract.approve(vaultAddress, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`Approval confirmed. Tx: ${approveTx.hash}`);
  } else {
    console.log("Vault already has sufficient allowance.");
  }

  // 3. Deposit into Vault
  console.log("\nDepositing USDT into RelayerVault...");
  const depositTx = await vaultContract.deposit(usdtToken.address, amount);
  console.log(`Submitted tx: ${depositTx.hash}`);
  console.log("Waiting for confirmation on Sepolia...");
  await depositTx.wait();

  console.log("\nDeposit successful!");
  console.log(`Etherscan Tx: https://sepolia.etherscan.io/tx/${depositTx.hash}`);
  console.log(`Vault:        https://sepolia.etherscan.io/address/${vaultAddress}`);
}

main().catch((err) => {
  console.error("Deposit error:", err);
  process.exitCode = 1;
});
