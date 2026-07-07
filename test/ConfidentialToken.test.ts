import { expect } from "chai";
import { fhevm } from "hardhat";
import { ConfidentialToken } from "../typechain-types";
import {
  TestSigners,
  getSigners,
  deployToken,
  createEncryptedUint64,
} from "./helpers";

describe("ConfidentialToken (Morphex / MORPH)", function () {
  let token: ConfidentialToken;
  let signers: TestSigners;
  let tokenAddress: string;

  const INITIAL_SUPPLY = 1_000_000n;

  beforeEach(async function () {
    signers = await getSigners();
    token = await deployToken(signers, INITIAL_SUPPLY);
    tokenAddress = await token.getAddress();
  });

  // ──────────────────────────────────────────────
  //  Deployment
  // ──────────────────────────────────────────────

  describe("Deployment", function () {
    it("should have the correct name", async function () {
      expect(await token.name()).to.equal("Morphex");
    });

    it("should have the correct symbol", async function () {
      expect(await token.symbol()).to.equal("MORPH");
    });

    it("should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });
  });

  // ──────────────────────────────────────────────
  //  Mint
  // ──────────────────────────────────────────────

  describe("Mint", function () {
    it("should mint initial supply to deployer", async function () {
      const balanceHandle = await token.balanceOf(signers.deployer.address);
      const balance = await fhevm.decrypt64(balanceHandle);
      expect(balance).to.equal(INITIAL_SUPPLY);
    });

    it("should update total supply on mint", async function () {
      const supplyHandle = await token.totalSupply();
      const supply = await fhevm.decrypt64(supplyHandle);
      expect(supply).to.equal(INITIAL_SUPPLY);
    });

    it("should allow owner to mint additional tokens", async function () {
      const additionalAmount = 500_000n;
      await token.mint(signers.alice.address, additionalAmount);

      const balanceHandle = await token.balanceOf(signers.alice.address);
      const balance = await fhevm.decrypt64(balanceHandle);
      expect(balance).to.equal(additionalAmount);
    });

    it("should revert when non-owner tries to mint", async function () {
      await expect(
        token.connect(signers.alice).mint(signers.alice.address, 100n)
      ).to.be.reverted;
    });

    it("should revert when minting to zero address", async function () {
      await expect(
        token.mint("0x0000000000000000000000000000000000000000", 100n)
      ).to.be.revertedWith("ConfidentialToken: mint to zero address");
    });
  });

  // ──────────────────────────────────────────────
  //  Transfer
  // ──────────────────────────────────────────────

  describe("Transfer", function () {
    it("should transfer tokens between accounts", async function () {
      const transferAmount = 1_000n;

      // Create encrypted input for the transfer amount
      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        transferAmount
      );

      // Execute transfer
      await token.transfer(signers.alice.address, handle, inputProof);

      // Verify sender balance decreased
      const senderHandle = await token.balanceOf(signers.deployer.address);
      const senderBalance = await fhevm.decrypt64(senderHandle);
      expect(senderBalance).to.equal(INITIAL_SUPPLY - transferAmount);

      // Verify recipient balance increased
      const recipientHandle = await token.balanceOf(signers.alice.address);
      const recipientBalance = await fhevm.decrypt64(recipientHandle);
      expect(recipientBalance).to.equal(transferAmount);
    });

    it("should result in no-op when transferring more than balance (no revert)", async function () {
      // Try to transfer more than the deployer has
      const excessiveAmount = INITIAL_SUPPLY + 1n;

      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        excessiveAmount
      );

      // This should NOT revert — it should silently no-op
      await token.transfer(signers.alice.address, handle, inputProof);

      // Sender balance should be unchanged
      const senderHandle = await token.balanceOf(signers.deployer.address);
      const senderBalance = await fhevm.decrypt64(senderHandle);
      expect(senderBalance).to.equal(INITIAL_SUPPLY);

      // Recipient balance should still be zero
      const recipientHandle = await token.balanceOf(signers.alice.address);
      const recipientBalance = await fhevm.decrypt64(recipientHandle);
      expect(recipientBalance).to.equal(0n);
    });

    it("should revert when transferring to zero address", async function () {
      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        100n
      );

      await expect(
        token.transfer(
          "0x0000000000000000000000000000000000000000",
          handle,
          inputProof
        )
      ).to.be.revertedWith("ConfidentialToken: transfer to zero address");
    });

    it("should revert when transferring to self", async function () {
      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        100n
      );

      await expect(
        token.transfer(signers.deployer.address, handle, inputProof)
      ).to.be.revertedWith("ConfidentialToken: transfer to self");
    });
  });

  // ──────────────────────────────────────────────
  //  Approve + TransferFrom
  // ──────────────────────────────────────────────

  describe("Approve + TransferFrom", function () {
    it("should set encrypted allowance", async function () {
      const allowanceAmount = 5_000n;

      const { handle, inputProof } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        allowanceAmount
      );

      await token.approve(signers.alice.address, handle, inputProof);

      const allowanceHandle = await token.allowance(
        signers.deployer.address,
        signers.alice.address
      );
      const allowance = await fhevm.decrypt64(allowanceHandle);
      expect(allowance).to.equal(allowanceAmount);
    });

    it("should allow transferFrom within allowance", async function () {
      const allowanceAmount = 5_000n;
      const transferAmount = 3_000n;

      // Deployer approves Alice
      const { handle: approveHandle, inputProof: approveProof } =
        await createEncryptedUint64(
          tokenAddress,
          signers.deployer.address,
          allowanceAmount
        );
      await token.approve(signers.alice.address, approveHandle, approveProof);

      // Alice transfers from Deployer to Bob
      const { handle: transferHandle, inputProof: transferProof } =
        await createEncryptedUint64(
          tokenAddress,
          signers.alice.address,
          transferAmount
        );
      await token
        .connect(signers.alice)
        .transferFrom(
          signers.deployer.address,
          signers.bob.address,
          transferHandle,
          transferProof
        );

      // Verify Bob received tokens
      const bobHandle = await token.balanceOf(signers.bob.address);
      const bobBalance = await fhevm.decrypt64(bobHandle);
      expect(bobBalance).to.equal(transferAmount);

      // Verify allowance was reduced
      const remainingHandle = await token.allowance(
        signers.deployer.address,
        signers.alice.address
      );
      const remaining = await fhevm.decrypt64(remainingHandle);
      expect(remaining).to.equal(allowanceAmount - transferAmount);
    });

    it("should no-op transferFrom exceeding allowance (no revert)", async function () {
      const allowanceAmount = 1_000n;
      const excessiveTransfer = 2_000n;

      // Deployer approves Alice for 1000
      const { handle: approveHandle, inputProof: approveProof } =
        await createEncryptedUint64(
          tokenAddress,
          signers.deployer.address,
          allowanceAmount
        );
      await token.approve(signers.alice.address, approveHandle, approveProof);

      // Alice tries to transferFrom 2000 — should no-op, not revert
      const { handle: transferHandle, inputProof: transferProof } =
        await createEncryptedUint64(
          tokenAddress,
          signers.alice.address,
          excessiveTransfer
        );
      await token
        .connect(signers.alice)
        .transferFrom(
          signers.deployer.address,
          signers.bob.address,
          transferHandle,
          transferProof
        );

      // Deployer balance unchanged
      const deployerHandle = await token.balanceOf(signers.deployer.address);
      const deployerBalance = await fhevm.decrypt64(deployerHandle);
      expect(deployerBalance).to.equal(INITIAL_SUPPLY);

      // Bob received nothing
      const bobHandle = await token.balanceOf(signers.bob.address);
      const bobBalance = await fhevm.decrypt64(bobHandle);
      expect(bobBalance).to.equal(0n);
    });
  });

  // ──────────────────────────────────────────────
  //  Multiple operations
  // ──────────────────────────────────────────────

  describe("Multiple operations", function () {
    it("should handle sequential transfers correctly", async function () {
      // Deployer → Alice: 1000
      const { handle: h1, inputProof: p1 } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        1_000n
      );
      await token.transfer(signers.alice.address, h1, p1);

      // Deployer → Bob: 2000
      const { handle: h2, inputProof: p2 } = await createEncryptedUint64(
        tokenAddress,
        signers.deployer.address,
        2_000n
      );
      await token.transfer(signers.bob.address, h2, p2);

      // Alice → Bob: 500
      const { handle: h3, inputProof: p3 } = await createEncryptedUint64(
        tokenAddress,
        signers.alice.address,
        500n
      );
      await token.connect(signers.alice).transfer(signers.bob.address, h3, p3);

      // Verify final balances
      const deployerBalance = await fhevm.decrypt64(
        await token.balanceOf(signers.deployer.address)
      );
      expect(deployerBalance).to.equal(INITIAL_SUPPLY - 3_000n);

      const aliceBalance = await fhevm.decrypt64(
        await token.balanceOf(signers.alice.address)
      );
      expect(aliceBalance).to.equal(500n);

      const bobBalance = await fhevm.decrypt64(
        await token.balanceOf(signers.bob.address)
      );
      expect(bobBalance).to.equal(2_500n);
    });
  });
});
