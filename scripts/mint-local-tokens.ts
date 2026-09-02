import { ethers } from "hardhat";
import { promises as fs } from "node:fs";

const erc20Abi = ["function mint(address to,uint256 amount) external"];

async function main() {
  const recipient = process.env.LOCAL_USER;
  if (!recipient || !ethers.isAddress(recipient)) {
    throw new Error("Set LOCAL_USER to the wallet address that should receive test tokens.");
  }

  const env = await fs.readFile("frontend/.env.local", "utf8");
  const match = env.match(/^VITE_PUBLIC_TOKEN_LIST=(.+)$/m);
  if (!match) throw new Error("frontend/.env.local has no VITE_PUBLIC_TOKEN_LIST. Run npm run deploy:relayer-local first.");

  const publicTokens = JSON.parse(match[1]) as Array<{ symbol: string; address: string }>;
  const amount = ethers.parseUnits(process.env.LOCAL_TOKEN_AMOUNT || "1000", 6);
  for (const token of publicTokens) {
    const contract = new ethers.Contract(token.address, erc20Abi, (await ethers.getSigners())[0]);
    await (await contract.mint(recipient, amount)).wait();
    console.log(`Minted ${process.env.LOCAL_TOKEN_AMOUNT || "1000"} ${token.symbol} to ${recipient}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});