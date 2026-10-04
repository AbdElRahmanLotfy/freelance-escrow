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

  console.log(`Releasing payment for escrow #${escrowId}...`);

  const hash = await escrow.write.releasePayment([escrowId], {
    account: signer.account,
  });

  console.log(`✅ Payment released!`);
  console.log(`Transaction hash: ${hash}`);
  console.log(`\nCheck on BaseScan: https://sepolia.basescan.org/tx/${hash}`);
}

main().catch(console.error);
