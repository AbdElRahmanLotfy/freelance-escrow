import hre from "hardhat";
import { formatUnits, type Address } from "viem";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();

  const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
  const clientAddress = signer.account.address;
  const freelancerAddress =
    "0x1B9c6612F602AF4221295c0C085a676B74597746" as Address;

  const usdc = await viem.getContractAt("MockERC20", usdcAddress);

  const clientBalance = (await usdc.read.balanceOf([clientAddress])) as bigint;
  const freelancerBalance = (await usdc.read.balanceOf([
    freelancerAddress,
  ])) as bigint;

  console.log("=== USDC Balances ===\n");
  console.log(`Client (${clientAddress}):`);
  console.log(`  ${formatUnits(clientBalance, 6)} USDC\n`);
  console.log(`Freelancer (${freelancerAddress}):`);
  console.log(`  ${formatUnits(freelancerBalance, 6)} USDC\n`);
}

main().catch(console.error);
