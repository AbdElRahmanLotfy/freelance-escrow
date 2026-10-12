import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { getAddress, parseUnits, type Address } from "viem";

interface EscrowDetails {
  client: Address;
  freelancer: Address;
  arbitrator: Address;
  amount: bigint;
  yieldEarned: bigint;
  startTime: bigint;
  duration: bigint;
  state: number;
  clientDisputed: boolean;
  freelancerDisputed: boolean;
  yieldActive: boolean;
  scaledATokenShares: bigint;
}

const USDC = (amount: string) => parseUnits(amount, 6);
const WEEK = 7n * 24n * 60n * 60n;

describe("EscrowWithYield", async function () {
  const { viem, networkHelpers } = await hre.network.getOrCreate();

  async function deployEscrowFixture() {
    const [client, freelancer, arbitrator, other] =
      await viem.getWalletClients();

    const publicClient = await viem.getPublicClient();

    // Deploy mock USDC.
    const mockUSDC = await viem.deployContract("MockERC20", [
      "USD Coin",
      "USDC",
      6,
    ]);

    // Deploy mock Aave aUSDC.
    const mockAToken = await viem.deployContract("MockAToken", [
      "Aave USDC",
      "aUSDC",
      6,
    ]);

    // Deploy mock Aave Pool.
    const mockAavePool = await viem.deployContract("MockAavePool", [
      mockUSDC.address,
      mockAToken.address,
    ]);

    // Deploy escrow with all three constructor arguments.
    const escrow = await viem.deployContract("EscrowWithYield", [
      mockUSDC.address,
      mockAavePool.address,
      mockAToken.address,
    ]);

    // Give the client 10,000 mock USDC.
    await mockUSDC.write.mint([client.account.address, USDC("10000")]);

    return {
      escrow,
      mockUSDC,
      mockAToken,
      mockAavePool,
      client,
      freelancer,
      arbitrator,
      other,
      publicClient,
    };
  }

  async function createAndFundEscrow(
    fixture: Awaited<ReturnType<typeof deployEscrowFixture>>,
    amount: bigint,
    duration: bigint = WEEK,
    freelancerAddress?: Address,
  ) {
    const { escrow, mockUSDC, client, freelancer, arbitrator } = fixture;

    const hiredFreelancer = freelancerAddress ?? freelancer.account.address;

    await escrow.write.createEscrow(
      [hiredFreelancer, arbitrator.account.address, duration],
      { account: client.account },
    );

    const escrowId = (await escrow.read.getEscrowCount()) - 1n;

    await mockUSDC.write.approve([escrow.address, amount], {
      account: client.account,
    });

    await escrow.write.fundEscrow([escrowId, amount], {
      account: client.account,
    });

    return escrowId;
  }

  /**
   * Simulate yield accrual:
   * - Mint USDC to the pool (as if interest was earned)
   * - Mint aTokens to the beneficiary (the escrow contract)
   */
  async function simulateYield(
    fixture: Awaited<ReturnType<typeof deployEscrowFixture>>,
    amount: bigint,
  ) {
    await fixture.mockAavePool.write.simulateYield([
      fixture.escrow.address,
      amount,
    ]);
  }

  // =============================================================
  // 1. CREATE ESCROW
  // =============================================================

  await it("Should create an escrow", async () => {
    const { escrow, client, freelancer, arbitrator } =
      await networkHelpers.loadFixture(deployEscrowFixture);

    await escrow.write.createEscrow(
      [freelancer.account.address, arbitrator.account.address, WEEK],
      { account: client.account },
    );

    const details = (await escrow.read.getEscrow([0n])) as EscrowDetails;

    assert.equal(
      getAddress(details.client),
      getAddress(client.account.address),
    );
    assert.equal(
      getAddress(details.freelancer),
      getAddress(freelancer.account.address),
    );
    assert.equal(
      getAddress(details.arbitrator),
      getAddress(arbitrator.account.address),
    );
    assert.equal(details.amount, 0n);
    assert.equal(details.state, 0);
    assert.equal(details.yieldActive, false);
  });

  // =============================================================
  // 2. FUND ESCROW
  // =============================================================

  await it("Should fund an escrow and record Aave shares", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockAToken } = fixture;
    const amount = USDC("1000");

    const escrowId = await createAndFundEscrow(fixture, amount);

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.amount, amount);
    assert.equal(details.state, 1);
    assert.equal(details.yieldActive, true);
    assert.equal(details.scaledATokenShares, amount);
    assert.equal(await escrow.read.getTotalYieldPrincipal(), amount);
    assert.equal(await escrow.read.getTotalScaledATokenShares(), amount);
    assert.equal(await mockAToken.read.balanceOf([escrow.address]), amount);
    assert.equal(await escrow.read.getATokenBalance(), amount);
  });

  // =============================================================
  // 3. CALCULATE YIELD
  // =============================================================

  await it("Should calculate accrued yield correctly", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const principal = USDC("1000");
    const yieldAmount = USDC("100");

    const escrowId = await createAndFundEscrow(fixture, principal);

    await simulateYield(fixture, yieldAmount);

    const [calculatedPrincipal, currentValue, currentYield] =
      await fixture.escrow.read.getEscrowYieldValue([escrowId]);

    assert.equal(calculatedPrincipal, principal);
    assert.equal(currentValue, USDC("1100"));
    assert.equal(currentYield, yieldAmount);
  });

  // =============================================================
  // 4. START WORK
  // =============================================================

  await it("Should start work", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const escrowId = await createAndFundEscrow(fixture, USDC("1000"));

    await fixture.escrow.write.startWork([escrowId], {
      account: fixture.client.account,
    });

    const details = (await fixture.escrow.read.getEscrow([
      escrowId,
    ])) as EscrowDetails;

    assert.equal(details.state, 2);
    assert.ok(details.startTime > 0n);
  });

  // =============================================================
  // 5. RELEASE PAYMENT: 70% FREELANCER / 30% CLIENT
  // =============================================================

  await it("Should distribute yield 70/30 on release", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client, freelancer } = fixture;

    const principal = USDC("1000");
    const yieldAmount = USDC("100");

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });

    await simulateYield(fixture, yieldAmount);

    await networkHelpers.time.increase(Number(WEEK));

    const freelancerBefore = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);
    const clientBefore = await mockUSDC.read.balanceOf([
      client.account.address,
    ]);

    await escrow.write.releasePayment([escrowId], { account: client.account });

    const freelancerAfter = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);
    const clientAfter = await mockUSDC.read.balanceOf([client.account.address]);

    assert.equal(freelancerAfter - freelancerBefore, USDC("1070"));
    assert.equal(clientAfter - clientBefore, USDC("30"));

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.state, 3);
    assert.equal(details.amount, 0n);
    assert.equal(details.yieldEarned, yieldAmount);
    assert.equal(details.yieldActive, false);
    assert.equal(await escrow.read.getTotalYieldPrincipal(), 0n);
    assert.equal(await escrow.read.getTotalScaledATokenShares(), 0n);
  });

  // =============================================================
  // 6. RELEASE WITHOUT YIELD
  // =============================================================

  await it("Should release principal when no yield is earned", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client, freelancer } = fixture;
    const principal = USDC("1000");

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });

    await networkHelpers.time.increase(Number(WEEK));

    const freelancerBefore = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);

    await escrow.write.releasePayment([escrowId], { account: client.account });

    const freelancerAfter = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);

    assert.equal(freelancerAfter - freelancerBefore, principal);

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.state, 3);
    assert.equal(details.yieldEarned, 0n);
  });

  // =============================================================
  // 7. REFUND: CLIENT GETS PRINCIPAL + ALL YIELD
  // =============================================================

  await it("Should return principal and all yield on refund", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client } = fixture;

    const principal = USDC("1000");
    const yieldAmount = USDC("100");

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });

    await simulateYield(fixture, yieldAmount);

    const clientBefore = await mockUSDC.read.balanceOf([
      client.account.address,
    ]);

    await escrow.write.refundClient([escrowId], { account: client.account });

    const clientAfter = await mockUSDC.read.balanceOf([client.account.address]);

    assert.equal(clientAfter - clientBefore, principal + yieldAmount);

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.state, 4);
    assert.equal(details.amount, 0n);
    assert.equal(details.yieldEarned, yieldAmount);
    assert.equal(await escrow.read.getTotalYieldPrincipal(), 0n);
    assert.equal(await escrow.read.getTotalScaledATokenShares(), 0n);
  });

  // =============================================================
  // 8. REFUND WITHOUT YIELD
  // =============================================================

  await it("Should refund principal when no yield is earned", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client } = fixture;
    const principal = USDC("1000");

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });

    const clientBefore = await mockUSDC.read.balanceOf([
      client.account.address,
    ]);

    await escrow.write.refundClient([escrowId], { account: client.account });

    const clientAfter = await mockUSDC.read.balanceOf([client.account.address]);

    assert.equal(clientAfter - clientBefore, principal);

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.state, 4);
    assert.equal(details.yieldEarned, 0n);
  });

  // =============================================================
  // 9. RAISE DISPUTE
  // =============================================================

  await it("Should allow the client to raise a dispute", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client } = fixture;

    const escrowId = await createAndFundEscrow(fixture, USDC("1000"));

    await escrow.write.startWork([escrowId], { account: client.account });

    await escrow.write.raiseDispute([escrowId], { account: client.account });

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.state, 5);
    assert.equal(details.clientDisputed, true);
    assert.equal(details.yieldActive, true);
  });

  // =============================================================
  // 10. DISPUTE: ARBITRATOR GETS 10% OF YIELD
  // =============================================================

  await it("Should distribute dispute yield correctly", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client, freelancer, arbitrator } = fixture;

    const principal = USDC("1000");
    const yieldAmount = USDC("100");

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });

    await simulateYield(fixture, yieldAmount);

    await escrow.write.raiseDispute([escrowId], { account: client.account });

    const arbitratorBefore = await mockUSDC.read.balanceOf([
      arbitrator.account.address,
    ]);
    const freelancerBefore = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);

    await escrow.write.resolveDispute([escrowId, freelancer.account.address], {
      account: arbitrator.account,
    });

    const arbitratorAfter = await mockUSDC.read.balanceOf([
      arbitrator.account.address,
    ]);
    const freelancerAfter = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);

    assert.equal(arbitratorAfter - arbitratorBefore, USDC("10"));
    assert.equal(freelancerAfter - freelancerBefore, USDC("1090"));

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.state, 3);
    assert.equal(details.yieldEarned, yieldAmount);
    assert.equal(details.amount, 0n);
  });

  // =============================================================
  // 11. DISPUTE WON BY CLIENT
  // =============================================================

  await it("Should allow the client to win a dispute", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client, arbitrator } = fixture;

    const principal = USDC("1000");
    const yieldAmount = USDC("100");

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });

    await simulateYield(fixture, yieldAmount);

    await escrow.write.raiseDispute([escrowId], { account: client.account });

    const clientBefore = await mockUSDC.read.balanceOf([
      client.account.address,
    ]);

    await escrow.write.resolveDispute([escrowId, client.account.address], {
      account: arbitrator.account,
    });

    const clientAfter = await mockUSDC.read.balanceOf([client.account.address]);

    assert.equal(clientAfter - clientBefore, USDC("1090"));

    const arbitratorBalance = await mockUSDC.read.balanceOf([
      arbitrator.account.address,
    ]);
    assert.equal(arbitratorBalance, USDC("10"));

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;
    assert.equal(details.state, 3);
  });

  // =============================================================
  // 12. MULTIPLE ESCROWS SHARE ONE AAVE POSITION
  // =============================================================

  await it("Should account for multiple escrows sharing Aave", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, other } = fixture;

    const amount1 = USDC("1000");
    const amount2 = USDC("2000");

    await createAndFundEscrow(fixture, amount1);
    await createAndFundEscrow(fixture, amount2, WEEK, other.account.address);

    assert.equal(await escrow.read.getTotalYieldPrincipal(), USDC("3000"));
    assert.equal(await escrow.read.getTotalScaledATokenShares(), USDC("3000"));

    await simulateYield(fixture, USDC("300"));

    const [, value0, yield0] = await escrow.read.getEscrowYieldValue([0n]);
    const [, value1, yield1] = await escrow.read.getEscrowYieldValue([1n]);

    assert.equal(value0, USDC("1100"));
    assert.equal(yield0, USDC("100"));
    assert.equal(value1, USDC("2200"));
    assert.equal(yield1, USDC("200"));
  });

  // =============================================================
  // 13. WITHDRAW ONE ESCROW WITHOUT CORRUPTING THE OTHER
  // =============================================================

  await it("Should preserve remaining escrow accounting after withdrawal", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client } = fixture;

    const amount1 = USDC("1000");
    const amount2 = USDC("2000");

    await createAndFundEscrow(fixture, amount1);
    await createAndFundEscrow(
      fixture,
      amount2,
      WEEK,
      fixture.other.account.address,
    );

    await simulateYield(fixture, USDC("300"));

    await escrow.write.startWork([0n], { account: client.account });
    await networkHelpers.time.increase(Number(WEEK));
    await escrow.write.releasePayment([0n], { account: client.account });

    assert.equal(await escrow.read.getTotalYieldPrincipal(), amount2);
    assert.equal(await escrow.read.getTotalScaledATokenShares(), amount2);

    const [, remainingValue, remainingYield] =
      await escrow.read.getEscrowYieldValue([1n]);

    assert.equal(remainingValue, USDC("2200"));
    assert.equal(remainingYield, USDC("200"));
  });

  // =============================================================
  // 14. CANNOT RELEASE BEFORE THE WORK PERIOD EXPIRES
  // =============================================================

  await it("Should reject release before the duration expires", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client } = fixture;

    const escrowId = await createAndFundEscrow(fixture, USDC("1000"));

    await escrow.write.startWork([escrowId], { account: client.account });

    await assert.rejects(
      escrow.write.releasePayment([escrowId], { account: client.account }),
    );
  });

  // =============================================================
  // 15. ONLY CLIENT CAN FUND
  // =============================================================

  await it("Should prevent a non-client from funding an escrow", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client, freelancer, arbitrator } = fixture;

    await escrow.write.createEscrow(
      [freelancer.account.address, arbitrator.account.address, WEEK],
      { account: client.account },
    );

    await assert.rejects(
      escrow.write.fundEscrow([0n, USDC("1000")], {
        account: freelancer.account,
      }),
    );
  });

  // =============================================================
  // 16. UNRELATED ACCOUNT CANNOT RAISE DISPUTE
  // =============================================================

  await it("Should prevent an unrelated account from raising a dispute", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client, other } = fixture;

    const escrowId = await createAndFundEscrow(fixture, USDC("1000"));

    await escrow.write.startWork([escrowId], { account: client.account });

    await assert.rejects(
      escrow.write.raiseDispute([escrowId], { account: other.account }),
    );
  });

  // =============================================================
  // 17. ONLY ARBITRATOR CAN RESOLVE DISPUTES
  // =============================================================

  await it("Should prevent a non-arbitrator from resolving a dispute", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client, freelancer, other } = fixture;

    const escrowId = await createAndFundEscrow(fixture, USDC("1000"));

    await escrow.write.startWork([escrowId], { account: client.account });
    await escrow.write.raiseDispute([escrowId], { account: client.account });

    await assert.rejects(
      escrow.write.resolveDispute([escrowId, freelancer.account.address], {
        account: other.account,
      }),
    );
  });

  // =============================================================
  // 18. PAUSE / UNPAUSE
  // =============================================================

  await it("Should pause and unpause the protocol", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client } = fixture;

    await escrow.write.pause([], { account: client.account });
    assert.equal(await escrow.read.isPaused(), true);

    await escrow.write.unpause([], { account: client.account });
    assert.equal(await escrow.read.isPaused(), false);
  });

  // =============================================================
  // 19. PAUSED PROTOCOL CANNOT CREATE ESCROWS
  // =============================================================

  await it("Should prevent creating escrows while paused", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, client, freelancer, arbitrator } = fixture;

    await escrow.write.pause([], { account: client.account });

    await assert.rejects(
      escrow.write.createEscrow(
        [freelancer.account.address, arbitrator.account.address, WEEK],
        { account: client.account },
      ),
    );
  });

  // =============================================================
  // 20. ROUNDING — 1 WEI YIELD
  // =============================================================

  await it("Should handle 1 wei of yield without losing funds", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client, freelancer } = fixture;

    const principal = USDC("1000");
    const yieldAmount = 1n; // 1 wei

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });
    await simulateYield(fixture, yieldAmount);
    await networkHelpers.time.increase(Number(WEEK));

    const freelancerBefore = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);
    const clientBefore = await mockUSDC.read.balanceOf([
      client.account.address,
    ]);

    await escrow.write.releasePayment([escrowId], { account: client.account });

    const freelancerAfter = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);
    const clientAfter = await mockUSDC.read.balanceOf([client.account.address]);

    // (1 * 70) / 100 = 0 → freelancer gets no bonus
    // clientDiscount = 1 - 0 = 1 → client gets 1 wei
    assert.equal(freelancerAfter - freelancerBefore, principal);
    assert.equal(clientAfter - clientBefore, 1n);

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;
    assert.equal(details.state, 3);
    assert.equal(details.yieldEarned, 1n);

    assert.equal(await escrow.read.getTotalYieldPrincipal(), 0n);
    assert.equal(await escrow.read.getTotalScaledATokenShares(), 0n);
  });

  // =============================================================
  // 21. ROUNDING — 10 UNITS SPLIT EVENLY
  // =============================================================

  await it("Should split yield correctly when 70/30 is exact", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);

    const { escrow, mockUSDC, client, freelancer } = fixture;

    const principal = USDC("1000");
    const yieldAmount = 10n; // 10 wei

    const escrowId = await createAndFundEscrow(fixture, principal);

    await escrow.write.startWork([escrowId], { account: client.account });
    await simulateYield(fixture, yieldAmount);
    await networkHelpers.time.increase(Number(WEEK));

    const freelancerBefore = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);
    const clientBefore = await mockUSDC.read.balanceOf([
      client.account.address,
    ]);

    await escrow.write.releasePayment([escrowId], { account: client.account });

    const freelancerAfter = await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ]);
    const clientAfter = await mockUSDC.read.balanceOf([client.account.address]);

    // (10 * 70) / 100 = 7 → freelancer
    // 10 - 7 = 3 → client
    assert.equal(freelancerAfter - freelancerBefore, principal + 7n);
    assert.equal(clientAfter - clientBefore, 3n);
  });
});
