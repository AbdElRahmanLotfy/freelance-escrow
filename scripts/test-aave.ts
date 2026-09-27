import hre from "hardhat";
import { type Address } from "viem";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const [signer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
  const aavePoolAddress =
    "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b" as Address;

  console.log("Testing Aave integration...");
  console.log("USDC:", usdcAddress);
  console.log("Aave Pool:", aavePoolAddress);
  console.log("");

  // Get USDC contract (uses your MockERC20 artifact which matches ERC20)
  const usdc = await viem.getContractAt("MockERC20", usdcAddress);

  // Check balance
  const balance = (await usdc.read.balanceOf([
    signer.account.address,
  ])) as bigint;
  console.log("Your USDC balance:", Number(balance) / 10 ** 6, "USDC");

  // Check Aave Pool supports this USDC using viem's readContract
  try {
    const reserveData = await publicClient.readContract({
      address: aavePoolAddress,
      abi: [
        {
          inputs: [{ name: "asset", type: "address" }],
          name: "getReserveData",
          outputs: [
            {
              name: "data",
              type: "tuple",
              components: [
                { name: "configuration", type: "uint256" },
                { name: "liquidityIndex", type: "uint128" },
                { name: "variableBorrowIndex", type: "uint128" },
                { name: "currentLiquidityRate", type: "uint128" },
                { name: "currentVariableBorrowRate", type: "uint128" },
                { name: "currentStableBorrowRate", type: "uint128" },
                { name: "lastUpdateTimestamp", type: "uint40" },
                { name: "id", type: "uint16" },
                { name: "aTokenAddress", type: "address" },
                { name: "stableDebtTokenAddress", type: "address" },
                { name: "variableDebtTokenAddress", type: "address" },
                { name: "interestRateStrategyAddress", type: "address" },
                { name: "accruedToTreasury", type: "uint128" },
                { name: "unbackedMinted", type: "uint128" },
                { name: "isolationModeTotalDebt", type: "uint128" },
              ],
            },
          ],
          stateMutability: "view",
          type: "function",
        },
      ] as const, // ← Keep 'as const' for strict viem typing
      functionName: "getReserveData",
      args: [usdcAddress],
    });

    console.log("");
    console.log("✅ Aave Pool is working");
    console.log("Reserve data struct received successfully.");
    console.log("");

    // Extract the liquidity rate from the decoded tuple object
    const liquidityRate = reserveData.currentLiquidityRate;

    // Convert Ray (10^27) to a human-readable percentage format
    const apy = (Number(liquidityRate) / 1e27) * 100;
    console.log("Liquidity rate (APY):", apy.toFixed(4), "%");
  } catch (error: any) {
    console.error("");
    console.error("❌ Aave Pool test failed:", error.message);
  }
}

main().catch(console.error);
