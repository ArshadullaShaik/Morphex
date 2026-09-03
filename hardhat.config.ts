import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@fhevm/hardhat-plugin";

// Hardhat configuration variables (set via `npx hardhat vars set <VAR>`)
// These are optional for local development — only needed for testnet deployment
const MNEMONIC = (() => {
  try {
    return require("hardhat").vars.get("MNEMONIC");
  } catch {
    return "test test test test test test test test test test test junk";
  }
})();

const SEPOLIA_RPC_URL = process.env.ALCHEMY_API_KEY
  ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : "https://ethereum-sepolia-rpc.publicnode.com";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // The confidential AMM contains intentionally dense FHE arithmetic circuits.
      // IR compilation avoids stack-depth limits while retaining optimizer output.
      viaIR: true,
      evmVersion: "cancun",
    },
  },

  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      // Mock FHE mode — no coprocessor needed for local testing
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
        count: 10,
      },
      chainId: 11155111,
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
