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
  const escrowId = 0n;

  console.log(`Starting work on escrow #${escrowId}...`);

  const hash = await escrow.write.startWork([escrowId], {
    account: signer.account,
  });

  console.log(`✅ Work started!`);
  console.log(`Transaction hash: ${hash}`);
  console.log(`\nCheck on BaseScan: https://sepolia.basescan.org/tx/${hash}`);
}

main().catch(console.error);
