import hre from "hardhat";
import { type Address } from "viem";

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const publicClient = await viem.getPublicClient();

  const escrowAddress = process.env.ESCROW_ADDRESS as Address;

  if (!escrowAddress) {
    throw new Error("ESCROW_ADDRESS not set in .env");
  }

  console.log("Escrow:", escrowAddress);
  console.log("");

  const abi = [
    {
      inputs: [],
      name: "stablecoin",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "yieldStrategy",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "aToken",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
  ] as const;

  for (const fn of ["stablecoin", "yieldStrategy", "aToken"] as const) {
    const result = await publicClient.readContract({
      address: escrowAddress,
      abi,
      functionName: fn,
    });
    console.log(`${fn}: ${result}`);
  }
}

main().catch(console.error);
