import { fhevm } from "hardhat";

async function main() {
  await fhevm.initializeCLIApi();
  const mockUtils = await import("@fhevm/mock-utils");
  console.log("fhevm isMock:", fhevm.isMock);
  console.log("fhevm debugger:", !!fhevm.debugger);
  console.log("FhevmType keys:", Object.keys(mockUtils.FhevmType || {}));
  console.log("FhevmType values:", Object.values(mockUtils.FhevmType || {}));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
