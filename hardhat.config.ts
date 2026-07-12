import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@fhevm/hardhat-plugin";
import "hardhat-deploy";

// Hardhat configuration variables (set via `npx hardhat vars set <VAR>`)
// These are optional for local development — only needed for testnet deployment
const MNEMONIC = (() => {
  try {
    return require("hardhat").vars.get("MNEMONIC");
  } catch {
    return "test test test test test test test test test test test junk";
  }
})();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },

  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      // Mock FHE mode — no coprocessor needed for local testing
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY || ""}`,
      accounts: {
        mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
        count: 10,
      },
      chainId: 11155111,
    },
  },

  namedAccounts: {
    deployer: {
      default: 0,
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
  },

  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
