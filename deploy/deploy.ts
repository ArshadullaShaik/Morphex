import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const TOKEN_NAME = "Morphex";
const TOKEN_SYMBOL = "MORPH";
const INITIAL_SUPPLY = BigInt(1_000_000); // 1M tokens (6 decimals per ERC-7984 spec)

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Morphex — Confidential Token Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Network:  ${hre.network.name}`);
  console.log(`  Deployer: ${deployer}`);
  console.log();

  // 1. Deploy the MorphexToken contract
  const result = await deploy("MorphexToken", {
    from: deployer,
    args: [TOKEN_NAME, TOKEN_SYMBOL, deployer],
    log: true,
    waitConfirmations: hre.network.name === "hardhat" ? 1 : 5,
  });

  console.log(`  ✓ MorphexToken deployed at: ${result.address}`);

  // 2. Mint initial supply to deployer
  if (result.newlyDeployed) {
    console.log(`  Minting ${INITIAL_SUPPLY.toLocaleString()} MORPH to deployer...`);

    await execute(
      "MorphexToken",
      { from: deployer, log: true },
      "mint",
      deployer,
      INITIAL_SUPPLY
    );

    console.log(`  ✓ Initial supply minted`);
  }

  console.log();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Deployment complete");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
};

func.tags = ["MorphexToken"];
export default func;
