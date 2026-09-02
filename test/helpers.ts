import { ethers } from "hardhat";
import { fhevm } from "hardhat";

// Patch missing decrypt64 helper in newer fhevm versions using the debugger
if (fhevm && !(fhevm as any).decrypt64) {
  (fhevm as any).decrypt64 = async (handle: any) => {
    return fhevm.debugger.decryptEuint(5, handle); // 5 corresponds to FhevmType.euint64
  };
}

export async function decrypt64(handle: any): Promise<bigint> {
  return (fhevm as any).decrypt64(handle);
}

export async function decryptBool(handle: any): Promise<boolean> {
  return fhevm.debugger.decryptEbool(handle);
}

/**
 * Standard signers for tests.
 * - deployer: contract owner, can mint
 * - alice: regular user
 * - bob: regular user
 * - carol: regular user (for operator / transferFrom flows)
 */
export async function getSigners() {
  const [deployer, alice, bob, carol] = await ethers.getSigners();
  return { deployer, alice, bob, carol };
}

/**
 * Deploy a fresh MorphexToken for testing.
 * Mints `initialSupply` to the deployer.
 */
export async function deployToken(initialSupply: bigint = 1_000_000n) {
  const signers = await getSigners();
  const factory = await ethers.getContractFactory("MorphexToken", signers.deployer);
  const token = await factory.deploy("Morphex", "MORPH", signers.deployer.address);
  await token.waitForDeployment();

  // Mint initial supply
  const tokenAddress = await token.getAddress();
  const encrypted = await createEncryptedUint64(tokenAddress, signers.deployer.address, initialSupply);
  const tx = await token.mint(signers.deployer.address, encrypted.handle, encrypted.inputProof);
  await tx.wait();

  return { token, signers, tokenAddress };
}

/**
 * Create an encrypted uint64 input for a given contract and signer.
 * Returns the handle and input proof needed for confidentialTransfer calls.
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
