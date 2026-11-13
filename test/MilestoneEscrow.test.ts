import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { getAddress, parseUnits, type Address } from "viem";

interface Milestone {
  amount: bigint;
  isReleased: boolean;
  workSubmittedAt: bigint;
  isDisputed: boolean;
}

interface EscrowDetails {
  client: Address;
  freelancer: Address;
  arbitrator: Address;
  totalAmount: bigint;
  state: number;
  yieldActive: boolean;
  scaledATokenShares: bigint;
  milestones: Milestone[];
}

const USDC = (amount: string) => parseUnits(amount, 6);
const DAY = 24n * 60n * 60n;

describe("EscrowWithYield (Milestones)", async function () {
  const { viem, networkHelpers } = await hre.network.getOrCreate();

  async function deployEscrowFixture() {
    const [client, freelancer, arbitrator, other] =
      await viem.getWalletClients();

    const publicClient = await viem.getPublicClient();

    const mockUSDC = await viem.deployContract("MockERC20", [
      "USD Coin",
      "USDC",
      6,
    ]);

    const mockAToken = await viem.deployContract("MockAToken", [
      "Aave USDC",
      "aUSDC",
      6,
    ]);

    const mockAavePool = await viem.deployContract("MockAavePool", [
      mockUSDC.address,
      mockAToken.address,
    ]);

    const escrow = await viem.deployContract("MilestoneEscrow", [
      mockUSDC.address,
      mockAavePool.address,
      mockAToken.address,
    ]);

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

  type EscrowContract = Awaited<
    ReturnType<typeof deployEscrowFixture>
  >["escrow"];

  async function getEscrowCount(escrow: EscrowContract): Promise<bigint> {
    return (await escrow.read.getEscrowCount()) as bigint;
  }

  async function createAndFundEscrow(
    fixture: Awaited<ReturnType<typeof deployEscrowFixture>>,
    milestoneAmounts: bigint[],
    freelancerAddress?: Address,
  ) {
    const { escrow, mockUSDC, client, freelancer, arbitrator } = fixture;
    const hiredFreelancer = freelancerAddress ?? freelancer.account.address;

    // Calculate total
    let totalAmount = 0n;
    for (let i = 0; i < milestoneAmounts.length; i++) {
      totalAmount += milestoneAmounts[i];
    }

    await escrow.write.createEscrow(
      [hiredFreelancer, arbitrator.account.address, milestoneAmounts],
      { account: client.account },
    );

    const escrowId = (await getEscrowCount(escrow)) - 1n;

    await mockUSDC.write.approve([escrow.address, totalAmount], {
      account: client.account,
    });

    await escrow.write.fundEscrow([escrowId, totalAmount], {
      account: client.account,
    });

    return escrowId;
  }

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
  await it("Should create an escrow with milestones", async () => {
    const { escrow, client, freelancer, arbitrator } =
      await networkHelpers.loadFixture(deployEscrowFixture);

    await escrow.write.createEscrow(
      [
        freelancer.account.address,
        arbitrator.account.address,
        [USDC("300"), USDC("700")],
      ],
      { account: client.account },
    );

    const details = (await escrow.read.getEscrow([0n])) as EscrowDetails;

    assert.equal(
      getAddress(details.client),
      getAddress(client.account.address),
    );
    assert.equal(details.totalAmount, USDC("1000"));
    assert.equal(details.milestones.length, 2);
    assert.equal(details.milestones[0].amount, USDC("300"));
    assert.equal(details.milestones[1].amount, USDC("700"));
    assert.equal(details.state, 0); // Created
  });

  // =============================================================
  // 2. FUND ESCROW
  // =============================================================
  await it("Should fund an escrow and record Aave shares", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, mockAToken } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("300"),
      USDC("700"),
    ]);

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;

    assert.equal(details.totalAmount, USDC("1000"));
    assert.equal(details.state, 1); // InProgress
    assert.equal(details.yieldActive, true);
    assert.equal(
      await mockAToken.read.balanceOf([escrow.address]),
      USDC("1000"),
    );
  });

  // =============================================================
  // 3. SUBMIT WORK
  // =============================================================
  await it("Should allow freelancer to submit work for a milestone", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, freelancer } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("300"),
      USDC("700"),
    ]);

    await escrow.write.submitMilestone([escrowId, 0n], {
      account: freelancer.account,
    });

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;
    assert.ok(details.milestones[0].workSubmittedAt > 0n);
    assert.equal(details.milestones[1].workSubmittedAt, 0n);
  });

  // =============================================================
  // 4. RELEASE MILESTONE (7-day review)
  // =============================================================
  await it("Should release a milestone after 7 days", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, mockUSDC, client, freelancer } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("300"),
      USDC("700"),
    ]);

    await escrow.write.submitMilestone([escrowId, 0n], {
      account: freelancer.account,
    });
    await networkHelpers.time.increase(Number(7n * DAY));

    const freelancerBefore = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;

    await escrow.write.releaseMilestone([escrowId, 0n], {
      account: client.account,
    });

    const freelancerAfter = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;

    assert.equal(freelancerAfter - freelancerBefore, USDC("300"));

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;
    assert.equal(details.milestones[0].isReleased, true);
    assert.equal(details.milestones[1].isReleased, false);
    assert.equal(details.state, 1); // Still InProgress
  });

  // =============================================================
  // 5. AUTO RELEASE MILESTONE (14-day)
  // =============================================================
  await it("Should auto-release a milestone after 14 days", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, mockUSDC, freelancer } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("300"),
      USDC("700"),
    ]);

    await escrow.write.submitMilestone([escrowId, 0n], {
      account: freelancer.account,
    });
    await networkHelpers.time.increase(Number(14n * DAY));

    const freelancerBefore = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;

    await escrow.write.autoReleaseMilestone([escrowId, 0n], {
      account: freelancer.account,
    });

    const freelancerAfter = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;

    assert.equal(freelancerAfter - freelancerBefore, USDC("300"));
  });

  // =============================================================
  // 6. FULL COMPLETION
  // =============================================================
  await it("Should mark escrow as Released when all milestones are done", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, client, freelancer } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("300"),
      USDC("700"),
    ]);

    // Release M1
    await escrow.write.submitMilestone([escrowId, 0n], {
      account: freelancer.account,
    });
    await networkHelpers.time.increase(Number(7n * DAY));
    await escrow.write.releaseMilestone([escrowId, 0n], {
      account: client.account,
    });

    // Release M2
    await escrow.write.submitMilestone([escrowId, 1n], {
      account: freelancer.account,
    });
    await networkHelpers.time.increase(Number(7n * DAY));
    await escrow.write.releaseMilestone([escrowId, 1n], {
      account: client.account,
    });

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;
    assert.equal(details.state, 2); // Released
  });

  // =============================================================
  // 7. DISPUTE A MILESTONE
  // =============================================================
  await it("Should allow a dispute on a specific milestone", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, client, freelancer } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("300"),
      USDC("700"),
    ]);

    await escrow.write.submitMilestone([escrowId, 0n], {
      account: freelancer.account,
    });
    await escrow.write.raiseDispute([escrowId, 0n], {
      account: client.account,
    });

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;
    assert.equal(details.milestones[0].isDisputed, true);
  });

  // =============================================================
  // 8. RESOLVE DISPUTE
  // =============================================================
  await it("Should resolve a dispute for a specific milestone", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, mockUSDC, client, freelancer, arbitrator } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("300"),
      USDC("700"),
    ]);

    await escrow.write.submitMilestone([escrowId, 0n], {
      account: freelancer.account,
    });
    await escrow.write.raiseDispute([escrowId, 0n], {
      account: client.account,
    });

    const freelancerBefore = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;

    await escrow.write.resolveDispute(
      [escrowId, 0n, freelancer.account.address],
      { account: arbitrator.account },
    );

    const freelancerAfter = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;

    assert.equal(freelancerAfter - freelancerBefore, USDC("300"));

    const details = (await escrow.read.getEscrow([escrowId])) as EscrowDetails;
    assert.equal(details.milestones[0].isDisputed, false);
    assert.equal(details.milestones[0].isReleased, true);
  });

  // =============================================================
  // 9. YIELD SPLIT ON MILESTONE RELEASE
  // =============================================================
  await it("Should split yield 70/30 on milestone release", async () => {
    const fixture = await networkHelpers.loadFixture(deployEscrowFixture);
    const { escrow, mockUSDC, client, freelancer } = fixture;

    const escrowId = await createAndFundEscrow(fixture, [
      USDC("1000"),
      USDC("1000"),
    ]);

    await simulateYield(fixture, USDC("100"));

    await escrow.write.submitMilestone([escrowId, 0n], {
      account: freelancer.account,
    });
    await networkHelpers.time.increase(Number(7n * DAY));

    const freelancerBefore = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;
    const clientBefore = (await mockUSDC.read.balanceOf([
      client.account.address,
    ])) as bigint;

    await escrow.write.releaseMilestone([escrowId, 0n], {
      account: client.account,
    });

    const freelancerAfter = (await mockUSDC.read.balanceOf([
      freelancer.account.address,
    ])) as bigint;
    const clientAfter = (await mockUSDC.read.balanceOf([
      client.account.address,
    ])) as bigint;

    // Milestone 1 is 50% of escrow, so claims 50% of the 100 yield (50 USDC)
    // Freelancer: 1000 + (50 * 70%) = 1035
    // Client: (50 * 30%) = 15
    assert.equal(freelancerAfter - freelancerBefore, USDC("1035"));
    assert.equal(clientAfter - clientBefore, USDC("15"));
  });
});
