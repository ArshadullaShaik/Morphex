import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

const INITIAL_SUPPLY = 1_000_000n;
const INITIAL_LIQUIDITY = 200_000n;

async function mintConfidential(token: any, recipient: string) {
  const tokenAddress = await token.getAddress();
  const input = fhevm.createEncryptedInput(tokenAddress, recipient);
  input.add64(INITIAL_SUPPLY);
  const encrypted = await input.encrypt();
  await (await token.mint(recipient, encrypted.handles[0], encrypted.inputProof)).wait();
}

async function seedPair(pair: string, tokenA: any, tokenB: any, deployer: string) {
  const pairContract = await ethers.getContractAt("ConfidentialPair", pair);
  const [token0, token1] = (await tokenA.getAddress()).toLowerCase() < (await tokenB.getAddress()).toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
  const operatorExpiry = Math.floor(Date.now() / 1000) + 86_400;
  await (await token0.setOperator(pair, operatorExpiry)).wait();
  await (await token1.setOperator(pair, operatorExpiry)).wait();
  const encrypted0 = fhevm.createEncryptedInput(pair, deployer).add64(INITIAL_LIQUIDITY);
  const encrypted1 = fhevm.createEncryptedInput(pair, deployer).add64(INITIAL_LIQUIDITY);
  const encryptedShares = fhevm.createEncryptedInput(pair, deployer).add64(INITIAL_LIQUIDITY);
  const [input0, input1, shares] = await Promise.all([encrypted0.encrypt(), encrypted1.encrypt(), encryptedShares.encrypt()]);
  await (await pairContract.addLiquidity(
    input0.handles[0], input1.handles[0], shares.handles[0],
    input0.inputProof, input1.inputProof, shares.inputProof,
  )).wait();
}

async function main() {
  // Required for encrypted-input creation outside the Hardhat test runner.
  // Supported deployment targets are localhost and Sepolia.
  await fhevm.initializeCLIApi();
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying Morphex from ${deployer.address}`);

  const tokenFactory = await ethers.getContractFactory("MorphexToken", deployer);
  const tokenSpecs = [
    ["Morphex", "MORPH"],
    ["Morphex USD", "mUSD"],
  ];
  const tokens = [] as any[];
  for (const [name, symbol] of tokenSpecs) {
    const token = await tokenFactory.deploy(name, symbol, deployer.address);
    await token.waitForDeployment();
    tokens.push(token);
  }
  const [morph, usd] = tokens;

  const factoryFactory = await ethers.getContractFactory("ConfidentialPairFactory", deployer);
  const pairFactory = await factoryFactory.deploy();
  await pairFactory.waitForDeployment();

  for (const token of tokens) {
    await mintConfidential(token, deployer.address);
  }

  const pairAddresses: Record<string, string> = {};
  for (let first = 0; first < tokens.length; first += 1) {
    for (let second = first + 1; second < tokens.length; second += 1) {
      const addressA = await tokens[first].getAddress();
      const addressB = await tokens[second].getAddress();
      await (await pairFactory.createPair(addressA, addressB)).wait();
      const pairAddress = await pairFactory.getPair(addressA, addressB);
      pairAddresses[`${addressA.toLowerCase()}-${addressB.toLowerCase()}`] = pairAddress;
      await seedPair(pairAddress, tokens[first], tokens[second], deployer.address);
    }
  }

  const morphAddress = await morph.getAddress();
  const usdAddress = await usd.getAddress();
  const pair = await pairFactory.getPair(morphAddress, usdAddress);
  const tokenList = await Promise.all(tokens.map(async (token, index) => ({
    name: tokenSpecs[index][0],
    symbol: tokenSpecs[index][1],
    address: await token.getAddress(),
  })));
  const deployment = {
    morph: morphAddress,
    musd: usdAddress,
    factory: await pairFactory.getAddress(),
    pair,
    tokens: tokenList,
    pairs: pairAddresses,
  };
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isSepolia = chainId === 11155111;
  const chainName = isSepolia ? "Sepolia Testnet" : "Hardhat Local";
  const rpcUrl = isSepolia
    ? process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
    : "http://127.0.0.1:8545";
  await fs.writeFile(
    "frontend/.env.local",
    `VITE_PAIR_ADDRESS=${deployment.pair}\nVITE_FACTORY_ADDRESS=${deployment.factory}\nVITE_MORPH_ADDRESS=${deployment.morph}\nVITE_MUSD_ADDRESS=${deployment.musd}\nVITE_TOKEN_LIST=${JSON.stringify(deployment.tokens)}\nVITE_PAIR_LIST=${JSON.stringify(deployment.pairs)}\nVITE_CHAIN_ID=${chainId}\nVITE_CHAIN_NAME=${chainName}\nVITE_RPC_URL=${rpcUrl}\n`,
  );
  console.log("\nDeployment Summary:");
  console.log(JSON.stringify(deployment, null, 2));

  if (isSepolia) {
    console.log("\nSepolia Etherscan Links:");
    console.log(`- MORPH Token: https://sepolia.etherscan.io/address/${deployment.morph}`);
    console.log(`- mUSD Token:  https://sepolia.etherscan.io/address/${deployment.musd}`);
    console.log(`- PairFactory: https://sepolia.etherscan.io/address/${deployment.factory}`);
    console.log(`- Pair:        https://sepolia.etherscan.io/address/${deployment.pair}`);
  }

  console.log("\nFrontend addresses written to frontend/.env.local");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
