import { ethers, fhevm } from "hardhat";
import { promises as fs } from "node:fs";

const DEFAULT_LIQUIDITY = 100_000n;
const TOKEN_CATALOG = [
  ["USDT", "Tether"], ["USDC", "USD Coin"], ["LINK", "Chainlink"], ["SHIB", "Shiba Inu"],
  ["UNI", "Uniswap"], ["AAVE", "Aave"], ["PEPE", "Pepe"], ["MKR", "Maker"], ["DAI", "Dai"],
  ["LDO", "Lido DAO"], ["ONDO", "Ondo"], ["ENA", "Ethena"], ["WETH", "Wrapped Ether"],
  ["WBTC", "Wrapped Bitcoin"], ["CRV", "Curve DAO"], ["ARB", "Arbitrum"], ["OP", "Optimism"],
  ["POL", "Polygon"], ["GRT", "The Graph"], ["SAND", "The Sandbox"], ["MANA", "Decentraland"],
  ["APE", "ApeCoin"], ["IMX", "Immutable"], ["AXS", "Axie Infinity"], ["COMP", "Compound"],
  ["SNX", "Synthetix"], ["RPL", "Rocket Pool"], ["ENS", "Ethereum Name Service"],
  ["PAXG", "Pax Gold"], ["FLOKI", "FLOKI"],
] as const;

function selectedCatalog() {
  const symbols = process.env.DEPLOY_SYMBOLS || "USDC,USDT";
  const requested = symbols.split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
  if (!requested || requested.length === 0) return TOKEN_CATALOG.filter(([s]) => s === "USDC" || s === "USDT");
  const selected = TOKEN_CATALOG.filter(([symbol]) => requested.includes(symbol));
  const missing = requested.filter((symbol) => !selected.some(([catalogSymbol]) => catalogSymbol === symbol));
  if (missing.length > 0) throw new Error(`Unknown DEPLOY_SYMBOLS value(s): ${missing.join(", ")}`);
  return selected;
}

type PublicToken = { symbol: string; name: string; address: string };

function configuredAddresses(): Record<string, string> {
  try {
    const addresses = JSON.parse(process.env.TOKEN_ADDRESSES || "{}");
    if (!addresses || typeof addresses !== "object") throw new Error();
    return addresses as Record<string, string>;
  } catch {
    throw new Error('TOKEN_ADDRESSES must be JSON such as {"USDT":"0x...","USDC":"0x..."}');
  }
}

async function deployMockToken(name: string, symbol: string) {
  const factory = await ethers.getContractFactory("MockERC20");
  const token = await factory.deploy(name, symbol, 6);
  await token.waitForDeployment();
  return token;
}

async function encryptedInput(contract: string, signer: string, amount: bigint) {
  return fhevm.createEncryptedInput(contract, signer).add64(amount).encrypt();
}

async function main() {
  await fhevm.initializeCLIApi();
  const [deployer] = await ethers.getSigners();
  const suppliedAddresses = configuredAddresses();
  const mockSymbols = new Set(
    (process.env.MOCK_SYMBOLS || '').split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
  );
  const publicTokens: PublicToken[] = [];

  for (const [symbol, name] of selectedCatalog()) {
    const mock = process.env.DEPLOY_MOCK_TOKENS || mockSymbols.has(symbol)
      ? await deployMockToken(`Mock ${name}`, symbol)
      : undefined;
    const address = mock ? await mock.getAddress() : suppliedAddresses[symbol];
    if (!address || !ethers.isAddress(address)) {
      throw new Error(`Missing valid address for ${symbol}. Configure TOKEN_ADDRESSES or use DEPLOY_MOCK_TOKENS=1.`);
    }
    publicTokens.push({ symbol, name, address });
  }

  const escapeDelay = BigInt(process.env.ESCAPE_HATCH_DELAY || "86400");
  const vault = await (await ethers.getContractFactory("RelayerVault", deployer))
    .deploy(deployer.address, deployer.address, escapeDelay);
  await vault.waitForDeployment();

  const tokenFactory = await ethers.getContractFactory("MorphexToken", deployer);
  const confidentialTokens = new Map<string, any>();
  for (const token of publicTokens) {
    const confidential = await tokenFactory.deploy(`Confidential ${token.name}`, `c${token.symbol}`, deployer.address);
    await confidential.waitForDeployment();
    await (await confidential.setRelayerVault(await vault.getAddress())).wait();
    await (await confidential.setUnderlyingToken(token.address)).wait();
    confidentialTokens.set(token.symbol, confidential);
  }

  const factory = await (await ethers.getContractFactory("ConfidentialPairFactory", deployer)).deploy();
  await factory.waitForDeployment();
  const usdc = confidentialTokens.get("USDC");
  if (!usdc) throw new Error("USDC is required as the quote token");
  const pairList: Record<string, string> = {};
  const pairAddresses = new Map<string, string>();

  for (const token of publicTokens) {
    const confidential = confidentialTokens.get(token.symbol);
    if (token.symbol === "USDC" || !confidential) continue;
    const tokenAddress = await confidential.getAddress();
    const quoteAddress = await usdc.getAddress();
    await (await factory.createPair(tokenAddress, quoteAddress)).wait();
    const pair = await factory.getPair(tokenAddress, quoteAddress);
    pairList[[tokenAddress.toLowerCase(), quoteAddress.toLowerCase()].sort().join("-")] = pair;
    pairAddresses.set(token.symbol, pair);
  }

  for (const [symbol, confidential] of confidentialTokens) {
    const mint = await encryptedInput(await confidential.getAddress(), deployer.address, DEFAULT_LIQUIDITY);
    await (await confidential.mint(deployer.address, mint.handles[0], mint.inputProof)).wait();
    const pair = symbol === "USDC" ? undefined : pairAddresses.get(symbol);
    if (pair) await (await confidential.setOperator(pair, Math.floor(Date.now() / 1000) + 86_400)).wait();
  }

  for (const token of publicTokens.filter((item) => item.symbol !== "USDC")) {
    const confidential = confidentialTokens.get(token.symbol);
    const pair = pairAddresses.get(token.symbol);
    if (!confidential || !pair) continue;
    await (await usdc.setOperator(pair, Math.floor(Date.now() / 1000) + 86_400)).wait();
    const amount0 = await encryptedInput(pair, deployer.address, DEFAULT_LIQUIDITY);
    const amount1 = await encryptedInput(pair, deployer.address, DEFAULT_LIQUIDITY);
    const shares = await encryptedInput(pair, deployer.address, DEFAULT_LIQUIDITY);
    await (await (await ethers.getContractAt("ConfidentialPair", pair)).addLiquidity(
      amount0.handles[0], amount1.handles[0], shares.handles[0],
      amount0.inputProof, amount1.inputProof, shares.inputProof,
    )).wait();
  }

  const wrapperList = await Promise.all(publicTokens.map(async (token) => ({
    name: `Confidential ${token.name}`,
    symbol: `c${token.symbol}`,
    address: await confidentialTokens.get(token.symbol).getAddress(),
  })));
  const deployment = {
    vault: await vault.getAddress(),
    relayer: deployer.address,
    publicTokens,
    confidentialTokens: wrapperList,
    factory: await factory.getAddress(),
    pairs: pairList,
  };
  const network = await ethers.provider.getNetwork();
  const isLocal = network.chainId === 31337n;
  const rpcUrl = isLocal
    ? "http://127.0.0.1:8545"
    : process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

  const envContent = [
    `VITE_PAIR_ADDRESS=${pairAddresses.get("USDT") || Object.values(pairList)[0] || ""}`,
    `VITE_FACTORY_ADDRESS=${await factory.getAddress()}`,
    `VITE_MORPH_ADDRESS=${wrapperList.find((token) => token.symbol === "cUSDT")?.address || wrapperList[0]?.address || ""}`,
    `VITE_MUSD_ADDRESS=${await usdc.getAddress()}`,
    `VITE_TOKEN_LIST=${JSON.stringify(wrapperList)}`,
    `VITE_PAIR_LIST=${JSON.stringify(pairList)}`,
    `VITE_RELAYER_VAULT_ADDRESS=${await vault.getAddress()}`,
    `VITE_PUBLIC_TOKEN_LIST=${JSON.stringify(publicTokens)}`,
    `VITE_CHAIN_ID=${network.chainId.toString()}`,
    `VITE_CHAIN_NAME=${isLocal ? "Hardhat Local" : "Sepolia Testnet"}`,
    `VITE_RPC_URL=${rpcUrl}`,
  ].join("\n") + "\n";

  await fs.writeFile("frontend/.env.relayer.local", envContent);
  await fs.writeFile("frontend/.env.local", envContent);

  console.log("\nDeployment Summary:");
  console.log(JSON.stringify(deployment, null, 2));

  if (!isLocal) {
    console.log("\nSepolia Etherscan Links:");
    console.log(`- RelayerVault: https://sepolia.etherscan.io/address/${await vault.getAddress()}`);
    console.log(`- PairFactory:  https://sepolia.etherscan.io/address/${await factory.getAddress()}`);
    for (const wrapper of wrapperList) {
      console.log(`- ${wrapper.name} (${wrapper.symbol}): https://sepolia.etherscan.io/address/${wrapper.address}`);
    }
    for (const [pairKey, pairAddr] of Object.entries(pairList)) {
      console.log(`- Pair [${pairKey}]: https://sepolia.etherscan.io/address/${pairAddr}`);
    }
  }

  console.log("\nFrontend environment written to frontend/.env.local and frontend/.env.relayer.local");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});