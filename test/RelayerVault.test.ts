import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { createEncryptedUint64, getSigners } from "./helpers";

describe("RelayerVault + confidential bridge", function () {
  async function setup() {
    const signers = await getSigners();

    const Usdt = await ethers.getContractFactory("MockERC20", signers.deployer);
    const usdt = await Usdt.deploy("USD Tether", "USDT", 6);
    await usdt.waitForDeployment();

    const vaultFactory = await ethers.getContractFactory("RelayerVault", signers.deployer);
    const vault = await vaultFactory.deploy(
      signers.deployer.address,
      signers.deployer.address,
      60n,
    );
    await vault.waitForDeployment();

    const tokenFactory = await ethers.getContractFactory("MorphexToken", signers.deployer);
    const token = await tokenFactory.deploy(
      "Confidential USDT",
      "cUSDT",
      signers.deployer.address,
    );
    await token.waitForDeployment();

    await token.setRelayerVault(await vault.getAddress());
    await token.setUnderlyingToken(await usdt.getAddress());
    await token.setRelayer(signers.deployer.address);

    return { signers, usdt, token, vault };
  }

  it("mints confidential balance after a public deposit and allows relayer payout", async function () {
    const { signers, usdt, token, vault } = await setup();
    const user = signers.alice;
    const depositAmount = 1_000_000n;

    await usdt.mint(user.address, depositAmount);
    await usdt.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(await usdt.getAddress(), depositAmount);

    const enc = await createEncryptedUint64(await token.getAddress(), signers.deployer.address, depositAmount);
    await token.connect(signers.deployer).relayerMint(user.address, enc.handle, enc.inputProof);
    expect(await token.confidentialBalanceOf(user.address)).to.not.equal(0n);

    const burn = await createEncryptedUint64(await token.getAddress(), user.address, 200_000n);
    const requestId = await token.connect(user).relayerBurnRequest.staticCall(burn.handle, burn.inputProof, 200_000n);
    await token.connect(user).relayerBurnRequest(burn.handle, burn.inputProof, 200_000n);

    const payout = [{ recipient: user.address, token: await usdt.getAddress(), amount: 200_000n }];
    await vault.connect(signers.deployer).batchWithdraw(payout, [requestId]);

    expect(await usdt.balanceOf(user.address)).to.equal(200_000n);
    const req = await vault.getWithdrawalRequest(requestId);
    expect(req.fulfilled).to.equal(true);
  });

  it("requires the delay before escape hatch can be used", async function () {
    const { signers, usdt, token, vault } = await setup();
    const amount = 250_000n;
    await usdt.mint(signers.alice.address, amount);
    await usdt.connect(signers.alice).approve(await vault.getAddress(), amount);
    await vault.connect(signers.alice).deposit(await usdt.getAddress(), amount);

    const mintAmount = await createEncryptedUint64(await token.getAddress(), signers.deployer.address, amount);
    await token.connect(signers.deployer).relayerMint(signers.alice.address, mintAmount.handle, mintAmount.inputProof);

    const burn = await createEncryptedUint64(await token.getAddress(), signers.alice.address, 100_000n);
    const requestId = await token.connect(signers.alice).relayerBurnRequest.staticCall(burn.handle, burn.inputProof, 100_000n);
    await token.connect(signers.alice).relayerBurnRequest(burn.handle, burn.inputProof, 100_000n);

    await expect(vault.connect(signers.alice).claimEscapedWithdrawal(requestId)).to.be.reverted;

    await time.increase(61);
    await vault.connect(signers.alice).claimEscapedWithdrawal(requestId);
    const req = await vault.getWithdrawalRequest(requestId);
    expect(req.fulfilled).to.equal(true);
  });

  it("prevents a withdrawal request from being fulfilled twice", async function () {
    const { signers, usdt, token, vault } = await setup();
    const amount = 300_000n;
    await usdt.mint(signers.alice.address, amount);
    await usdt.connect(signers.alice).approve(await vault.getAddress(), amount);
    await vault.connect(signers.alice).deposit(await usdt.getAddress(), amount);

    const mint = await createEncryptedUint64(await token.getAddress(), signers.deployer.address, amount);
    await token.connect(signers.deployer).relayerMint(signers.alice.address, mint.handle, mint.inputProof);

    const burn = await createEncryptedUint64(await token.getAddress(), signers.alice.address, 75_000n);
    const requestId = await token.connect(signers.alice).relayerBurnRequest.staticCall(burn.handle, burn.inputProof, 75_000n);
    await token.connect(signers.alice).relayerBurnRequest(burn.handle, burn.inputProof, 75_000n);

    const payout = [{ recipient: signers.alice.address, token: await usdt.getAddress(), amount: 75_000n }];
    await vault.connect(signers.deployer).batchWithdraw(payout, [requestId]);

    await expect(vault.connect(signers.alice).claimEscapedWithdrawal(requestId)).to.be.reverted;
  });

  it("only pays the requesting wallet and the request's underlying token and amount", async function () {
    const { signers, usdt, token, vault } = await setup();
    const amount = 100_000n;
    await usdt.mint(signers.alice.address, amount);
    await usdt.connect(signers.alice).approve(await vault.getAddress(), amount);
    await vault.connect(signers.alice).deposit(await usdt.getAddress(), amount);

    const mint = await createEncryptedUint64(await token.getAddress(), signers.deployer.address, amount);
    await token.connect(signers.deployer).relayerMint(signers.alice.address, mint.handle, mint.inputProof);
    const burn = await createEncryptedUint64(await token.getAddress(), signers.alice.address, amount);
    const requestId = await token.connect(signers.alice).relayerBurnRequest.staticCall(burn.handle, burn.inputProof, amount);
    await token.connect(signers.alice).relayerBurnRequest(burn.handle, burn.inputProof, amount);

    await expect(vault.connect(signers.deployer).batchWithdraw(
      [{ recipient: signers.bob.address, token: await usdt.getAddress(), amount }],
      [requestId],
    )).to.be.revertedWith("RelayerVault: recipient mismatch");
  });

  it("honors access control and signer rotation", async function () {
    const { signers, usdt, token, vault } = await setup();
    const enc = await createEncryptedUint64(await token.getAddress(), signers.alice.address, 10_000n);
    await expect(
      token.connect(signers.alice).relayerMint(signers.alice.address, enc.handle, enc.inputProof)
    ).to.be.reverted;

    await expect(
      vault.connect(signers.alice).batchWithdraw([{ recipient: signers.alice.address, token: await usdt.getAddress(), amount: 1n }], [0n])
    ).to.be.reverted;

    await usdt.mint(await vault.getAddress(), 10_000n);
    await vault.connect(signers.deployer).setRelayerSigner(signers.bob.address);

    await expect(
      vault.connect(signers.deployer).batchWithdraw([{ recipient: signers.alice.address, token: await usdt.getAddress(), amount: 1n }], [0n])
    ).to.be.reverted;

    await expect(
      vault.connect(signers.bob).batchWithdraw([{ recipient: signers.alice.address, token: await usdt.getAddress(), amount: 1n }], [0n])
    ).to.not.be.reverted;
  });
});
