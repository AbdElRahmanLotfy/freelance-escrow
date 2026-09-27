import hre from "hardhat";
import { type Address } from "viem";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const escrowAddress = process.env.ESCROW_ADDRESS as Address;

  if (!escrowAddress) {
    throw new Error("ESCROW_ADDRESS not set in .env");
  }

  const escrow = await viem.getContractAt("EscrowWithYield", escrowAddress);

  //  REPLACE WITH YOUR SECOND METAMASK ACCOUNT ADDRESS
  const freelancer = "0x1B9c6612F602AF4221295c0C085a676B74597746" as Address;

  // Arbitrator can be you (first account)
  const arbitrator = signer.account.address;

  const duration = 7n * 24n * 60n * 60n; // 7 days

  console.log("Creating escrow...");
  console.log("Client (you):", signer.account.address);
  console.log("Freelancer:", freelancer);
  console.log("Arbitrator:", arbitrator);
  console.log("Duration: 7 days\n");

  const hash = await escrow.write.createEscrow(
    [freelancer, arbitrator, duration],
    { account: signer.account },
  );

  console.log(`✅ Escrow created!`);
  console.log(`Transaction hash: ${hash}`);
  console.log(`\nCheck on BaseScan: https://sepolia.basescan.org/tx/${hash}`);
}

main().catch(console.error);
