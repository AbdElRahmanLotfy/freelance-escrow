import hre from "hardhat";
import { parseUnits, formatUnits, type Address } from "viem";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const escrowAddress = process.env.ESCROW_ADDRESS as Address;

  if (!escrowAddress) {
    throw new Error("ESCROW_ADDRESS not set in .env");
  }

  const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  const usdc = await viem.getContractAt("MockERC20", usdcAddress);

  const amount = parseUnits("10", 6);
  const hash = await usdc.write.approve([escrowAddress, amount], {
    account: signer.account,
  });

  console.log(`Approved ${formatUnits(amount, 6)} USDC for escrow contract`);
  console.log(`Transaction hash: ${hash}`);
}

main().catch(console.error);
