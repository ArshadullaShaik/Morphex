import { ethers } from "hardhat";
import { fhevm } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ConfidentialToken } from "../typechain-types";

/**
 * Standard signers for tests.
 * - deployer: contract owner, can mint
 * - alice: regular user
 * - bob: regular user
 * - carol: regular user (for allowance / transferFrom flows)
 */
export interface TestSigners {
  deployer: SignerWithAddress;
  alice: SignerWithAddress;
  bob: SignerWithAddress;
  carol: SignerWithAddress;
}

export async function getSigners(): Promise<TestSigners> {
  const [deployer, alice, bob, carol] = await ethers.getSigners();
  return { deployer, alice, bob, carol };
}

/**
 * Deploy a fresh ConfidentialToken for testing.
 * Mints `initialSupply` to the deployer.
 */
export async function deployToken(
  signers: TestSigners,
  initialSupply: bigint = 1_000_000n
): Promise<ConfidentialToken> {
  const factory = await ethers.getContractFactory("ConfidentialToken", signers.deployer);
  const token = await factory.deploy("Morphex", "MORPH", signers.deployer.address);
  await token.waitForDeployment();

  // Mint initial supply
  const tx = await token.mint(signers.deployer.address, initialSupply);
  await tx.wait();

  return token as unknown as ConfidentialToken;
}

/**
 * Create an encrypted uint64 input for a given contract and signer.
 * Returns the handles array and input proof needed for contract calls.
 */
export async function createEncryptedUint64(
  contractAddress: string,
  signerAddress: string,
  value: bigint
) {
  const input = fhevm.createEncryptedInput(contractAddress, signerAddress);
  input.add64(value);
  const encrypted = await input.encrypt();
  return {
    handle: encrypted.handles[0],
    inputProof: encrypted.inputProof,
  };
}
