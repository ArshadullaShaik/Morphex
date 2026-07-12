import { fhevm } from "hardhat";
import * as mockUtils from "@fhevm/mock-utils";

async function main() {
  await fhevm.initializeCLIApi();
  console.log("fhevm isMock:", fhevm.isMock);
  console.log("fhevm debugger:", !!fhevm.debugger);
  console.log("FhevmType keys:", Object.keys(mockUtils.FhevmType || {}));
  console.log("FhevmType values:", Object.values(mockUtils.FhevmType || {}));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
