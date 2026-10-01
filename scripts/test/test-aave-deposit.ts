import hre from "hardhat";
import { parseUnits, getContract, type Address } from "viem";
async function main() {
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
  const aavePoolAddress =
    "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b" as Address;

  console.log("Testing direct Aave deposit...\n");

  const usdc = await viem.getContractAt("MockERC20", usdcAddress);

  // Step 1: Approve Aave to spend USDC
  console.log("Step 1: Approving Aave...");
  // Check allowance before supply
  const allowance = (await usdc.read.allowance([
    signer.account.address,
    aavePoolAddress,
  ])) as bigint;
  console.log("Aave allowance:", Number(allowance) / 10 ** 6, "USDC");

  if (allowance < parseUnits("1", 6)) {
    console.log("Insufficient allowance, approving...");
    const approveHash = await usdc.write.approve([
      aavePoolAddress,
      parseUnits("1", 6),
    ]);
    console.log("Approval tx:", approveHash);
  }

  // Step 2: Try to supply to Aave
  console.log("Step 2: Supplying to Aave...");
  try {
    // 3. Use core viem's getContract method instead
    const aavePool = getContract({
      address: aavePoolAddress,
      abi: [
        {
          inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "onBehalfOf", type: "address" },
            { name: "referralCode", type: "uint16" },
          ],
          name: "supply",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ] as const,
      client: { public: publicClient, wallet: signer },
    });

    // 4. In native viem, methods live directly under .write
    const supplyHash = await aavePool.write.supply([
      usdcAddress,
      parseUnits("1", 6),
      signer.account.address,
      0,
    ]);

    console.log("✅ Supply succeeded!");
    console.log("Supply tx:", supplyHash);
  } catch (error: any) {
    console.error("❌ Supply failed!");
    console.error("Error:", error.message);
    if (error.cause) {
      console.error("Cause:", error.cause.message);
    }
  }
}

main().catch(console.error);
