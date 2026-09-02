import { expect } from "chai";
import { ethers } from "hardhat";
import { createEncryptedUint64, decrypt64, decryptBool, getSigners } from "./helpers";

describe("ConfidentialPair", function () {
  const LIQUIDITY = 200_000n;

  async function encryptForPair(pairAddress: string, signer: string, value: bigint) {
    return createEncryptedUint64(pairAddress, signer, value);
  }

  async function setup() {
    const signers = await getSigners();
    const tokenFactory = await ethers.getContractFactory("MorphexToken", signers.deployer);
    const first = await tokenFactory.deploy("Alpha", "ALPHA", signers.deployer.address);
    const second = await tokenFactory.deploy("Beta", "BETA", signers.deployer.address);
    await first.waitForDeployment();
    await second.waitForDeployment();

    const firstAddress = await first.getAddress();
    const secondAddress = await second.getAddress();
    for (const [token, address] of [[first, firstAddress], [second, secondAddress]] as const) {
      const minted = await createEncryptedUint64(address, signers.deployer.address, 1_000_000n);
      await token.mint(signers.deployer.address, minted.handle, minted.inputProof);
    }

    const factoryFactory = await ethers.getContractFactory("ConfidentialPairFactory", signers.deployer);
    const factory = await factoryFactory.deploy();
    await factory.waitForDeployment();
    await factory.createPair(firstAddress, secondAddress);
    const pairAddress = await factory.getPair(firstAddress, secondAddress);
    const pair = await ethers.getContractAt("ConfidentialPair", pairAddress, signers.deployer);

    const [token0, token1] = firstAddress.toLowerCase() < secondAddress.toLowerCase()
      ? [first, second]
      : [second, first];
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3_600);
    await token0.setOperator(pairAddress, expiry);
    await token1.setOperator(pairAddress, expiry);
    return { signers, token0, token1, pair, pairAddress };
  }

  it("keeps initial reserves and LP shares encrypted", async function () {
    const { signers, pair, pairAddress } = await setup();
    const amount0 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const amount1 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const shares = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    await pair.addLiquidity(amount0.handle, amount1.handle, shares.handle, amount0.inputProof, amount1.inputProof, shares.inputProof);

    const [reserve0, reserve1] = await pair.encryptedReserves();
    expect(await decrypt64(reserve0)).to.equal(LIQUIDITY);
    expect(await decrypt64(reserve1)).to.equal(LIQUIDITY);
    expect(await decrypt64(await pair.encryptedTotalShares())).to.equal(LIQUIDITY);
    expect(await decrypt64(await pair.lpBalanceOf(signers.deployer.address))).to.equal(LIQUIDITY - 1_000n);
  });

  it("calculates an encrypted exact-input swap and preserves liquidity accounting", async function () {
    const { signers, pair, pairAddress } = await setup();
    const amount0 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const amount1 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const shares = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    await pair.addLiquidity(amount0.handle, amount1.handle, shares.handle, amount0.inputProof, amount1.inputProof, shares.inputProof);

    const amountIn = 10_000n;
    const encryptedIn = await encryptForPair(pairAddress, signers.deployer.address, amountIn);
    const expectedOut = 9_496n;
    const encryptedOutput = await encryptForPair(pairAddress, signers.deployer.address, expectedOut);
    await pair.swapExactInput(true, encryptedIn.handle, encryptedOutput.handle, encryptedIn.inputProof, encryptedOutput.inputProof);

    const [usedIn, amountOut, success] = await pair.lastSwapOf(signers.deployer.address);
    expect(await decryptBool(success)).to.equal(true);
    expect(await decrypt64(usedIn)).to.equal(amountIn);

    expect(await decrypt64(amountOut)).to.equal(expectedOut);
    const [reserve0, reserve1] = await pair.encryptedReserves();
    expect(await decrypt64(reserve0)).to.equal(LIQUIDITY + amountIn);
    expect(await decrypt64(reserve1)).to.equal(LIQUIDITY - expectedOut);
  });

  it("mints and burns only encrypted proportional LP positions", async function () {
    const { signers, pair, pairAddress } = await setup();
    const initial0 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const initial1 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const initialShares = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    await pair.addLiquidity(
      initial0.handle, initial1.handle, initialShares.handle,
      initial0.inputProof, initial1.inputProof, initialShares.inputProof
    );

    const added0 = await encryptForPair(pairAddress, signers.deployer.address, 10_000n);
    const added1 = await encryptForPair(pairAddress, signers.deployer.address, 10_000n);
    const addedShares = await encryptForPair(pairAddress, signers.deployer.address, 10_000n);
    await pair.addLiquidity(
      added0.handle, added1.handle, addedShares.handle,
      added0.inputProof, added1.inputProof, addedShares.inputProof
    );
    expect(await decrypt64(await pair.encryptedTotalShares())).to.equal(210_000n);

    const burn = await encryptForPair(pairAddress, signers.deployer.address, 100_000n);
    const output0 = await encryptForPair(pairAddress, signers.deployer.address, 100_000n);
    const output1 = await encryptForPair(pairAddress, signers.deployer.address, 100_000n);
    await pair.removeLiquidity(
      burn.handle, output0.handle, output1.handle,
      burn.inputProof, output0.inputProof, output1.inputProof
    );

    const [reserve0, reserve1] = await pair.encryptedReserves();
    expect(await decrypt64(reserve0)).to.equal(110_000n);
    expect(await decrypt64(reserve1)).to.equal(110_000n);
    expect(await decrypt64(await pair.encryptedTotalShares())).to.equal(110_000n);
  });

  it("refunds an encrypted swap that misses its private minimum output", async function () {
    const { signers, pair, pairAddress } = await setup();
    const amount0 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const amount1 = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    const shares = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    await pair.addLiquidity(amount0.handle, amount1.handle, shares.handle, amount0.inputProof, amount1.inputProof, shares.inputProof);

    const encryptedIn = await encryptForPair(pairAddress, signers.deployer.address, 10_000n);
    const impossibleOutput = await encryptForPair(pairAddress, signers.deployer.address, LIQUIDITY);
    await pair.swapExactInput(true, encryptedIn.handle, impossibleOutput.handle, encryptedIn.inputProof, impossibleOutput.inputProof);

    const [usedIn, amountOut, success] = await pair.lastSwapOf(signers.deployer.address);
    expect(await decryptBool(success)).to.equal(false);
    expect(await decrypt64(usedIn)).to.equal(0n);
    expect(await decrypt64(amountOut)).to.equal(0n);
    const [reserve0, reserve1] = await pair.encryptedReserves();
    expect(await decrypt64(reserve0)).to.equal(LIQUIDITY);
    expect(await decrypt64(reserve1)).to.equal(LIQUIDITY);
  });
});
