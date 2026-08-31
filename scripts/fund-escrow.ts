import hre from "hardhat";
import { parseUnits, type Address } from "viem";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();

  // Cast the plain string environment variable to a strict Viem Address
  const escrowAddress = process.env.ESCROW_ADDRESS as Address;

  if (!escrowAddress) {
    throw new Error("ESCROW_ADDRESS not set in .env");
  }

  const escrow = await viem.getContractAt("EscrowWithYield", escrowAddress);

  const escrowId = 0; // First escrow
  const amount = parseUnits("10", 6);

  const hash = await escrow.write.fundEscrow([BigInt(escrowId), amount], {
    account: signer.account,
  });

  console.log(`Funded escrow #${escrowId} with 10 USDC`);
  console.log(`Transaction hash: ${hash}`);
}

main().catch(console.error);
