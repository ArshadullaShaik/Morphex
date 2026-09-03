import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

async function main() {
  const [signer] = await ethers.getSigners();
  const targetAddress = process.env.ADDRESS || signer.address;

  console.log("==================================================");
  console.log("  Morphex — Sepolia Balance Inspector");
  console.log("==================================================");
  console.log(`Checking account: ${targetAddress}\n`);

  // 1. Sepolia ETH Balance
  const ethBalance = await ethers.provider.getBalance(targetAddress);
  console.log(`1. Sepolia ETH: ${ethers.formatEther(ethBalance)} ETH\n`);

  // Read contracts from frontend/.env.local
  const envContent = await fs.readFile("frontend/.env.local", "utf8");
  const vaultLine = envContent.split("\n").find((l) => l.startsWith("VITE_RELAYER_VAULT_ADDRESS="));
  const publicTokensLine = envContent.split("\n").find((l) => l.startsWith("VITE_PUBLIC_TOKEN_LIST="));
  const confidentialTokensLine = envContent.split("\n").find((l) => l.startsWith("VITE_TOKEN_LIST="));

  const vaultAddress = vaultLine?.replace("VITE_RELAYER_VAULT_ADDRESS=", "").trim();
  const publicTokens = publicTokensLine ? JSON.parse(publicTokensLine.replace("VITE_PUBLIC_TOKEN_LIST=", "").trim()) : [];
  const confidentialTokens = confidentialTokensLine ? JSON.parse(confidentialTokensLine.replace("VITE_TOKEN_LIST=", "").trim()) : [];

  const erc20Abi = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  // 2. Public Token Balances
  console.log("2. Public Backing Tokens:");
  for (const token of publicTokens) {
    try {
      const contract = new ethers.Contract(token.address, erc20Abi, signer);
      const [bal, dec] = await Promise.all([contract.balanceOf(targetAddress), contract.decimals()]);
      console.log(`   - ${token.symbol} (${token.name}): ${ethers.formatUnits(bal, dec)} (Contract: ${token.address})`);
    } catch (e: any) {
      console.log(`   - ${token.symbol}: Error reading balance (${e.message || e})`);
    }
  }
  console.log("");

  // 3. Vault Deposited Balances (in RelayerVault)
  if (vaultAddress) {
    console.log("3. RelayerVault Custody Backing (Total Locked in Protocol):");
    console.log(`   Vault Address: ${vaultAddress}`);
    for (const token of publicTokens) {
      try {
        const contract = new ethers.Contract(token.address, erc20Abi, signer);
        const [bal, dec] = await Promise.all([contract.balanceOf(vaultAddress), contract.decimals()]);
        console.log(`   - Vault reserves of ${token.symbol}: ${ethers.formatUnits(bal, dec)}`);
      } catch (e: any) {
        console.log(`   - ${token.symbol}: Error reading vault balance`);
      }
    }
    console.log("");
  }

  // 4. Confidential Wrapper Tokens
  console.log("4. Confidential Assets (cTokens):");
  const decryptableHandles: Array<{ handle: string; contractAddress: string; token: any }> = [];

  for (const token of confidentialTokens) {
    try {
      const contract = await ethers.getContractAt("MorphexToken", token.address, signer);
      const handle = await contract.confidentialBalanceOf(targetAddress);
      const isZero = /^0x0{64}$/i.test(handle);
      if (!isZero) {
        decryptableHandles.push({ handle, contractAddress: token.address, token });
      } else {
        console.log(`   - ${token.symbol}: 0.000000 (Empty balance)`);
      }
    } catch (e: any) {
      console.log(`   - ${token.symbol}: Error reading balance (${e.message || e})`);
    }
  }

  // If inspecting deployer wallet, decrypt automatically with private key!
  if (targetAddress.toLowerCase() === signer.address.toLowerCase() && decryptableHandles.length > 0) {
    try {
      console.log("\n   Decrypting confidential balances automatically via Zama KMS...");
      await fhevm.initializeCLIApi();
      const instance = (fhevm as any)._fhevmEnv.instance;
      const keypair = instance.generateKeypair();
      const contractAddresses = decryptableHandles.map((d) => d.contractAddress);
      const startTimestamp = Math.floor(Date.now() / 1000);
      const eip712 = fhevm.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, 1);
      const { EIP712Domain: _domainType, ...signingTypes } = eip712.types;
      const signature = await signer.signTypedData(
        eip712.domain,
        signingTypes as unknown as Record<string, Array<{ name: string; type: string }>>,
        eip712.message,
      );
      const clearValues = await fhevm.userDecrypt(
        decryptableHandles.map((d) => ({ handle: d.handle, contractAddress: d.contractAddress })),
        keypair.privateKey,
        keypair.publicKey,
        signature,
        contractAddresses,
        signer.address,
        startTimestamp,
        1,
      );

      for (const d of decryptableHandles) {
        const handleKey = d.handle.toLowerCase();
        const matchingKey = Object.keys(clearValues).find(
          (k) => k.toLowerCase() === handleKey || k.toLowerCase().replace(/^0x/, "") === handleKey.replace(/^0x/, ""),
        );
        const rawVal = matchingKey ? clearValues[matchingKey as `0x${string}`] : 0n;
        const bigVal = typeof rawVal === "bigint" ? rawVal : BigInt(rawVal ?? 0);
        console.log(`   - ${d.token.symbol} (${d.token.name}): ${ethers.formatUnits(bigVal, 6)} [Decrypted Private Balance]`);
      }
    } catch (err: any) {
      console.log(`   (Automatic decryption notice: ${err.message || err})`);
    }
  }
}

main().catch((err) => {
  console.error("Inspector error:", err);
  process.exitCode = 1;
});
