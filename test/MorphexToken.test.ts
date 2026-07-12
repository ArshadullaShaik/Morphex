import { expect } from "chai";
import { fhevm } from "hardhat";
import { deployToken, createEncryptedUint64, getSigners } from "./helpers";

describe("MorphexToken (MORPH)", function () {
  const INITIAL_SUPPLY = 1_000_000n;

  async function setup() {
    return deployToken(INITIAL_SUPPLY);
  }

  // ──────────────────────────────────────────────
  //  Deployment
  // ──────────────────────────────────────────────

  describe("Deployment", function () {
    it("should have the correct name", async function () {
      const { token } = await setup();
      expect(await token.name()).to.equal("Morphex");
    });

    it("should have the correct symbol", async function () {
      const { token } = await setup();
      expect(await token.symbol()).to.equal("MORPH");
    });

    it("should have 6 decimals (ERC-7984 default)", async function () {
      const { token } = await setup();
      expect(await token.decimals()).to.equal(6);
    });
  });

  // ──────────────────────────────────────────────
  //  Mint
  // ──────────────────────────────────────────────

  describe("Mint", function () {
    it("should mint initial supply to deployer", async function () {
      const { token, signers } = await setup();
      const balanceHandle = await token.confidentialBalanceOf(signers.deployer.address);
      const balance = await fhevm.decrypt64(balanceHandle);
      expect(balance).to.equal(INITIAL_SUPPLY);
    });

    it("should update total supply on mint", async function () {
      const { token } = await setup();
      const supplyHandle = await token.confidentialTotalSupply();
      const supply = await fhevm.decrypt64(supplyHandle);
      expect(supply).to.equal(INITIAL_SUPPLY);
    });

    it("should allow owner to mint additional tokens", async function () {
      const { token, signers } = await setup();
      const additionalAmount = 500_000n;
      await token.mint(signers.alice.address, additionalAmount);

      const balanceHandle = await token.confidentialBalanceOf(signers.alice.address);
      const balance = await fhevm.decrypt64(balanceHandle);
      expect(balance).to.equal(additionalAmount);
    });

    it("should revert when non-owner tries to mint", async function () {
      const { token, signers } = await setup();
      await expect(
        token.connect(signers.alice).mint(signers.alice.address, 100n)
      ).to.be.reverted;
    });
  });

  // ──────────────────────────────────────────────
  //  confidentialTransfer
  // ──────────────────────────────────────────────

  describe("confidentialTransfer", function () {
    it("should transfer tokens between accounts", async function () {
      const { token, signers, tokenAddress } = await setup();
      const transferAmount = 1_000n;

      // Create encrypted input
      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        transferAmount
      );

      // Execute confidential transfer
      await token["confidentialTransfer(address,bytes32,bytes)"](
        signers.alice.address,
        handle,
        inputProof
      );

      // Verify sender balance decreased
      const senderBalance = await fhevm.decrypt64(
        await token.confidentialBalanceOf(signers.deployer.address)
      );
      expect(senderBalance).to.equal(INITIAL_SUPPLY - transferAmount);

      // Verify recipient balance increased
      const recipientBalance = await fhevm.decrypt64(
        await token.confidentialBalanceOf(signers.alice.address)
      );
      expect(recipientBalance).to.equal(transferAmount);
    });

    it("should no-op when transferring more than balance (no revert)", async function () {
      const { token, signers, tokenAddress } = await setup();
      const excessiveAmount = INITIAL_SUPPLY + 1n;

      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        excessiveAmount
      );

      // Should NOT revert — FHE.select resolves to no-op
      await token["confidentialTransfer(address,bytes32,bytes)"](
        signers.alice.address,
        handle,
        inputProof
      );

      // Sender balance unchanged
      const senderBalance = await fhevm.decrypt64(
        await token.confidentialBalanceOf(signers.deployer.address)
      );
      expect(senderBalance).to.equal(INITIAL_SUPPLY);

      // Recipient balance still zero
      const recipientBalance = await fhevm.decrypt64(
        await token.confidentialBalanceOf(signers.alice.address)
      );
      expect(recipientBalance).to.equal(0n);
    });
  });

  // ──────────────────────────────────────────────
  //  Operator + confidentialTransferFrom
  // ──────────────────────────────────────────────

  describe("Operator + confidentialTransferFrom", function () {
    it("should allow operator to transfer on behalf of holder", async function () {
      const { token, signers, tokenAddress } = await setup();
      const transferAmount = 3_000n;

      // Deployer sets Alice as operator (valid for 1 hour)
      const until = Math.floor(Date.now() / 1000) + 3600;
      await token.setOperator(signers.alice.address, until);
      expect(await token.isOperator(signers.deployer.address, signers.alice.address)).to.be.true;

      // Alice transfers from Deployer to Bob
      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.alice.address,
        transferAmount
      );
      await token
        .connect(signers.alice)
        ["confidentialTransferFrom(address,address,bytes32,bytes)"](
          signers.deployer.address,
          signers.bob.address,
          handle,
          inputProof
        );

      // Verify Bob received tokens
      const bobBalance = await fhevm.decrypt64(
        await token.confidentialBalanceOf(signers.bob.address)
      );
      expect(bobBalance).to.equal(transferAmount);
    });

    it("should revert when non-operator tries transferFrom", async function () {
      const { token, signers, tokenAddress } = await setup();

      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.alice.address,
        100n
      );

      await expect(
        token
          .connect(signers.alice)
          ["confidentialTransferFrom(address,address,bytes32,bytes)"](
            signers.deployer.address,
            signers.bob.address,
            handle,
            inputProof
          )
      ).to.be.reverted;
    });
  });

  // ──────────────────────────────────────────────
  //  Sequential operations
  // ──────────────────────────────────────────────

  describe("Sequential operations", function () {
    it("should handle multiple transfers correctly", async function () {
      const { token, signers, tokenAddress } = await setup();

      // Deployer → Alice: 1000
      const e1 = await createEncryptedUint64(tokenAddress, signers.deployer.address, 1_000n);
      await token["confidentialTransfer(address,bytes32,bytes)"](signers.alice.address, e1.handle, e1.inputProof);

      // Deployer → Bob: 2000
      const e2 = await createEncryptedUint64(tokenAddress, signers.deployer.address, 2_000n);
      await token["confidentialTransfer(address,bytes32,bytes)"](signers.bob.address, e2.handle, e2.inputProof);

      // Alice → Bob: 500
      const e3 = await createEncryptedUint64(tokenAddress, signers.alice.address, 500n);
      await token.connect(signers.alice)["confidentialTransfer(address,bytes32,bytes)"](signers.bob.address, e3.handle, e3.inputProof);

      // Verify final balances
      const deployerBal = await fhevm.decrypt64(await token.confidentialBalanceOf(signers.deployer.address));
      expect(deployerBal).to.equal(INITIAL_SUPPLY - 3_000n);

      const aliceBal = await fhevm.decrypt64(await token.confidentialBalanceOf(signers.alice.address));
      expect(aliceBal).to.equal(500n);

      const bobBal = await fhevm.decrypt64(await token.confidentialBalanceOf(signers.bob.address));
      expect(bobBal).to.equal(2_500n);
    });
  });
});
