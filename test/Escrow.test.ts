import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { getAddress, parseUnits, type Address } from "viem";

// Define an interface representing the Escrow struct from your Solidity contract
interface EscrowDetails {
  client: Address;
  freelancer: Address;
  arbitrator: Address;
  amount: bigint;
  state: number;
  yieldEarned: bigint;
  startTime: bigint;
  duration: bigint;
  clientDisputed: boolean;
  freelancerDisputed: boolean;
}

describe("EscrowWithYield", async function () {
  // Create a network connection for testing
  const { viem, networkHelpers } = await hre.network.getOrCreate();

  // Fixture for deploying contracts
  async function deployEscrowFixture() {
    // Get wallet clients (Viem equivalent of signers)
    const [client, freelancer, arbitrator, other] =
      await viem.getWalletClients();

    // Public client for reading blockchain data
    const publicClient = await viem.getPublicClient();

    // Deploy MockERC20
    const mockUSDC = await viem.deployContract("MockERC20", [
      "USD Coin",
      "USDC",
      6,
    ]);

    // Deploy Mock Yield Strategy
    const mockYield = await viem.deployContract("MockYieldStrategy");

    // Deploy EscrowWithYield
    const escrow = await viem.deployContract("EscrowWithYield", [
      mockUSDC.address,
      mockYield.address,
    ]);

    // Mint 1,000 USDC to the client (USDC has 6 decimals)
    await mockUSDC.write.mint([client.account.address, parseUnits("1000", 6)]);

    return {
      escrow,
      mockUSDC,
      mockYield,
      client,
      freelancer,
      arbitrator,
      other,
      publicClient,
    };
  }

  /*
   * ---------------------------------------------------------
   * TEST 1: Create Escrow
   * ---------------------------------------------------------
   */

  await it("Should create an escrow", async () => {
    const { escrow, client, freelancer, arbitrator } =
      await networkHelpers.loadFixture(deployEscrowFixture);

    // Create escrow with 7 days duration
    await escrow.write.createEscrow(
      [
        freelancer.account.address,
        arbitrator.account.address,
        7n * 24n * 60n * 60n,
      ],
      {
        account: client.account,
      },
    );

    // Read escrow #0
    const details = (await escrow.read.getEscrow([0n])) as EscrowDetails;

    // Verify client
    assert.equal(
      getAddress(details.client),
      getAddress(client.account.address),
    );

    // Verify freelancer
    assert.equal(
      getAddress(details.freelancer),
      getAddress(freelancer.account.address),
    );

    // Verify arbitrator
    assert.equal(
      getAddress(details.arbitrator),
      getAddress(arbitrator.account.address),
    );

    // State: 0 = Created
    assert.equal(details.state, 0);
  });

  /*
   * ---------------------------------------------------------
   * TEST 2: Fund Escrow
   * ---------------------------------------------------------
   */

  await it("Should fund an escrow", async () => {
    const { escrow, mockUSDC, client, freelancer, arbitrator } =
      await networkHelpers.loadFixture(deployEscrowFixture);

    // Create escrow
    await escrow.write.createEscrow(
      [
        freelancer.account.address,
        arbitrator.account.address,
        7n * 24n * 60n * 60n,
      ],
      {
        account: client.account,
      },
    );

    // Amount = 100 USDC
    const amount = parseUnits("100", 6);

    // Approve EscrowWithYield to spend client's USDC
    await mockUSDC.write.approve([escrow.address, amount], {
      account: client.account,
    });

    // Fund escrow #0
    await escrow.write.fundEscrow([0n, amount], {
      account: client.account,
    });

    // Read escrow
    const details = (await escrow.read.getEscrow([0n])) as EscrowDetails;

    // Verify amount
    assert.equal(details.amount, amount);

    // State: 1 = Funded
    assert.equal(details.state, 1);
  });

  /*
   * ---------------------------------------------------------
   * TEST 3: Release Payment with Yield Bonus
   * ---------------------------------------------------------
   */

  await it("Should release payment with yield bonus", async () => {
    const { escrow, mockUSDC, client, freelancer, arbitrator } =
      await networkHelpers.loadFixture(deployEscrowFixture);

    // Create escrow
    await escrow.write.createEscrow(
      [
        freelancer.account.address,
        arbitrator.account.address,
        7n * 24n * 60n * 60n,
      ],
      {
        account: client.account,
      },
    );

    // Fund with 100 USDC
    const amount = parseUnits("100", 6);
    await mockUSDC.write.approve([escrow.address, amount], {
      account: client.account,
    });
    await escrow.write.fundEscrow([0n, amount], {
      account: client.account,
    });

    // Start work
    await escrow.write.startWork([0n], {
      account: client.account,
    });

    // Move blockchain time forward 7 days
    await networkHelpers.time.increase(7 * 24 * 60 * 60);

    // Release payment
    await escrow.write.releasePayment([0n], {
      account: client.account,
    });

    // Read escrow
    const details = (await escrow.read.getEscrow([0n])) as EscrowDetails;

    // State: 3 = Released
    assert.equal(details.state, 3);
  });

  /*
   * ---------------------------------------------------------
   * TEST 4: Refund Client with Yield Compensation
   * ---------------------------------------------------------
   */

  await it("Should refund client with yield compensation", async () => {
    const { escrow, mockUSDC, client, freelancer, arbitrator } =
      await networkHelpers.loadFixture(deployEscrowFixture);

    // Create escrow
    await escrow.write.createEscrow(
      [
        freelancer.account.address,
        arbitrator.account.address,
        7n * 24n * 60n * 60n,
      ],
      {
        account: client.account,
      },
    );

    // Fund with 100 USDC
    const amount = parseUnits("100", 6);
    await mockUSDC.write.approve([escrow.address, amount], {
      account: client.account,
    });
    await escrow.write.fundEscrow([0n, amount], {
      account: client.account,
    });

    // Start work
    await escrow.write.startWork([0n], {
      account: client.account,
    });

    // Move time forward 7 days
    await networkHelpers.time.increase(7 * 24 * 60 * 60);

    // Refund client
    await escrow.write.refundClient([0n], {
      account: client.account,
    });

    // Read escrow
    const details = (await escrow.read.getEscrow([0n])) as EscrowDetails;

    // State: 4 = Refunded
    assert.equal(details.state, 4);
  });
});
