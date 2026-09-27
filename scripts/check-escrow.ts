import hre from "hardhat";
import { type Address } from "viem";

// Define the EscrowDetails interface matching your contract struct
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
}

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const escrowAddress = process.env.ESCROW_ADDRESS as Address;

  if (!escrowAddress) {
    throw new Error("ESCROW_ADDRESS not set in .env");
  }

  const escrow = await viem.getContractAt("EscrowWithYield", escrowAddress);

  // Get escrow counter
  const counter = (await escrow.read.escrowCounter()) as bigint;
  console.log(`Total escrows: ${counter}\n`);

  // Check each escrow
  for (let i = 0; i < Number(counter); i++) {
    const rawDetails = await escrow.read.getEscrow([BigInt(i)]);
    // Cast to our interface
    const details = rawDetails as unknown as EscrowDetails;

    console.log(`Escrow #${i}:`);
    console.log(`  Client:        ${details.client}`);
    console.log(`  Freelancer:    ${details.freelancer}`);
    console.log(`  Arbitrator:    ${details.arbitrator}`);
    console.log(`  Amount:        ${Number(details.amount) / 10 ** 6} USDC`);
    console.log(
      `  State:         ${details.state} (${getStateName(Number(details.state))})`,
    );
    console.log(`  Yield Active:  ${details.yieldActive}`);
    console.log(
      `  Yield Earned:  ${Number(details.yieldEarned) / 10 ** 6} USDC`,
    );
    console.log("");
  }
}

function getStateName(state: number): string {
  const states = [
    "Created",
    "Funded",
    "InProgress",
    "Released",
    "Refunded",
    "Disputed",
  ];
  return states[state] || "Unknown";
}

main().catch(console.error);
