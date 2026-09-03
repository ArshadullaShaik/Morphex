import { ethers, fhevm } from "hardhat";

const SEPOLIA_CHAIN_ID = 11155111n;
const ZAMA_SEPOLIA_ACL = "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D";
const ZAMA_SEPOLIA_KMS = "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A";

async function main() {
  console.log("==================================================");
  console.log("  Morphex Sepolia Pre-flight Diagnostic Tool");
  console.log("==================================================\n");

  // 1. Network connectivity
  console.log("1. Checking Sepolia RPC connection...");
  const network = await ethers.provider.getNetwork();
  console.log(`   Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    console.error(`   [ERROR] Expected Chain ID ${SEPOLIA_CHAIN_ID} (Sepolia), but got ${network.chainId}!`);
    process.exitCode = 1;
    return;
  }
  console.log("   [OK] Connected to Sepolia.");

  const blockNumber = await ethers.provider.getBlockNumber();
  const feeData = await ethers.provider.getFeeData();
  console.log(`   Current Block: ${blockNumber}`);
  console.log(`   Gas Price: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "unknown"} gwei\n`);

  // 2. Deployer account & balance
  console.log("2. Checking Deployer Account...");
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.error("   [ERROR] No accounts configured! Set PRIVATE_KEY in .env or via hardhat vars.");
    process.exitCode = 1;
    return;
  }

  const deployer = signers[0];
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEth = parseFloat(ethers.formatEther(balance));

  console.log(`   Deployer Address: ${deployer.address}`);
  console.log(`   Deployer Balance: ${balanceEth.toFixed(6)} ETH`);

  if (balanceEth === 0) {
    console.warn("   [WARNING] Deployer has 0 ETH! You must fund this wallet with Sepolia ETH before deploying.");
    console.warn("   Get free Sepolia ETH at: https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
  } else if (balanceEth < 0.05) {
    console.warn("   [WARNING] Balance is below recommended 0.05 Sepolia ETH for complete contract deployment.");
  } else {
    console.log("   [OK] Sufficient Sepolia ETH for deployment.");
  }
  console.log("");

  // 3. FHEVM and Zama Coprocessor verification
  console.log("3. Verifying Zama FHEVM Environment on Sepolia...");
  try {
    await fhevm.initializeCLIApi();
    console.log(`   FHEVM CLI API initialized.`);
    console.log(`   isMock: ${fhevm.isMock} (expected false for live Sepolia testnet)`);

    if (fhevm.isMock) {
      console.warn("   [WARNING] FHEVM is in mock mode instead of live Sepolia mode.");
    } else {
      console.log("   [OK] FHEVM running in live Sepolia mode.");
    }

    // Verify Zama ACL and KMS contracts
    const [aclCode, kmsCode] = await Promise.all([
      ethers.provider.getCode(ZAMA_SEPOLIA_ACL),
      ethers.provider.getCode(ZAMA_SEPOLIA_KMS),
    ]);

    if (aclCode !== "0x") {
      console.log(`   [OK] Zama Sepolia ACL verified at ${ZAMA_SEPOLIA_ACL}`);
    } else {
      console.error(`   [ERROR] Zama ACL contract not found at ${ZAMA_SEPOLIA_ACL}`);
    }

    if (kmsCode !== "0x") {
      console.log(`   [OK] Zama Sepolia KMS verified at ${ZAMA_SEPOLIA_KMS}`);
    } else {
      console.error(`   [ERROR] Zama KMS contract not found at ${ZAMA_SEPOLIA_KMS}`);
    }
  } catch (error) {
    console.error("   [ERROR] Failed to initialize FHEVM CLI API:", error);
    process.exitCode = 1;
    return;
  }

  console.log("\n==================================================");
  if (balanceEth >= 0.02) {
    console.log("  STATUS: READY FOR SEPOLIA DEPLOYMENT!");
    console.log("  Run: npm run deploy:sepolia:core");
  } else {
    console.log("  STATUS: Action Required — Fund deployer wallet with Sepolia ETH");
    console.log(`  Wallet: ${deployer.address}`);
  }
  console.log("==================================================\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
