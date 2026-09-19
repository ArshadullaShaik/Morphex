import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@fhevm/hardhat-plugin";

// Helper to resolve Hardhat vars safely without throwing
function getHardhatVar(key: string): string | undefined {
  try {
    return require("hardhat").vars.get(key);
  } catch {
    return undefined;
  }
}

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ||
  getHardhatVar("SEPOLIA_RPC_URL") ||
  (process.env.ALCHEMY_API_KEY
    ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : process.env.INFURA_API_KEY
      ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
      : "https://ethereum-sepolia.publicnode.com");

function getSepoliaAccounts(): { mnemonic: string; count: number } | string[] {
  const privateKey = process.env.PRIVATE_KEY || getHardhatVar("PRIVATE_KEY");
  if (privateKey) {
    const formatted = privateKey.trim().startsWith("0x") ? privateKey.trim() : `0x${privateKey.trim()}`;
    return [formatted];
  }

  const mnemonic =
    process.env.MNEMONIC ||
    getHardhatVar("MNEMONIC") ||
    "test test test test test test test test test test test junk";

  return {
    mnemonic,
    count: 10,
  };
}

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
      accounts: getSepoliaAccounts(),
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
