import hre from "hardhat";
import { formatUnits } from "viem";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const walletAddress = signer.account.address;

  console.log("Checking wallet:", walletAddress);

  // USDC contract on BaseSepolia
  const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  const usdc = await viem.getContractAt("MockERC20", usdcAddress);

  // Cast the returned unknown type to a bigint
  const balance = (await usdc.read.balanceOf([walletAddress])) as bigint;
  const decimals = 6; // USDC has 6 decimals

  console.log(`Your USDC balance: ${formatUnits(balance, decimals)} USDC`);
}

main().catch(console.error);
