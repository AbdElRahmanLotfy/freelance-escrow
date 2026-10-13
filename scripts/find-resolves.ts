import hre from "hardhat";
import { type Address, parseAbi } from "viem";

const CHUNK_SIZE = 10000n;
const MAX_BLOCKS_BACK = 100000n;

const EVENT_ABI = parseAbi([
  "event DisputeResolved(uint256 indexed escrowId, address indexed winner, uint256 amount, uint256 arbitratorFee)",
  "event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy)",
]);

async function main() {
  const { viem } = await hre.network.getOrCreate();
  const publicClient = await viem.getPublicClient();

  const escrowAddress = process.env.ESCROW_ADDRESS as Address;

  console.log("Escrow:", escrowAddress);
  console.log("");

  const currentBlock = await publicClient.getBlockNumber();
  console.log("Current block:", currentBlock);

  const startBlock =
    currentBlock > MAX_BLOCKS_BACK ? currentBlock - MAX_BLOCKS_BACK : 0n;

  console.log("Searching from block:", startBlock);
  console.log("");

  const resolvedLogs: any[] = [];
  const raisedLogs: any[] = [];

  for (let from = startBlock; from < currentBlock; from += CHUNK_SIZE) {
    const to =
      from + CHUNK_SIZE > currentBlock ? currentBlock : from + CHUNK_SIZE;

    process.stdout.write(`\rSearching blocks ${from} - ${to}...`);

    try {
      const [resolvedChunk, raisedChunk] = await Promise.all([
        publicClient.getLogs({
          address: escrowAddress,
          event: EVENT_ABI[0],
          fromBlock: from,
          toBlock: to,
        }),
        publicClient.getLogs({
          address: escrowAddress,
          event: EVENT_ABI[1],
          fromBlock: from,
          toBlock: to,
        }),
      ]);

      resolvedLogs.push(...resolvedChunk);
      raisedLogs.push(...raisedChunk);
    } catch (err: any) {
      console.error(`\n❌ Failed for blocks ${from}-${to}:`, err.message);
    }
  }

  console.log("\n");
  console.log(`═══ DisputeResolved Events (${resolvedLogs.length}) ═══\n`);

  for (const log of resolvedLogs) {
    console.log(`Escrow #${log.args.escrowId}`);
    console.log(`  Winner:         ${log.args.winner}`);
    console.log(`  Winner amount:  ${Number(log.args.amount) / 10 ** 6} USDC`);
    console.log(
      `  Arbitrator fee: ${Number(log.args.arbitratorFee) / 10 ** 6} USDC`,
    );
    console.log(`  Tx hash:        ${log.transactionHash}`);
    console.log(`  Block:          ${log.blockNumber}`);
    console.log(
      `  Explorer:       https://sepolia.basescan.org/tx/${log.transactionHash}`,
    );
    console.log("");
  }

  console.log(`═══ DisputeRaised Events (${raisedLogs.length}) ═══\n`);

  for (const log of raisedLogs) {
    console.log(`Escrow #${log.args.escrowId}`);
    console.log(`  Raised by:      ${log.args.raisedBy}`);
    console.log(`  Tx hash:        ${log.transactionHash}`);
    console.log(`  Block:          ${log.blockNumber}`);
    console.log(
      `  Explorer:       https://sepolia.basescan.org/tx/${log.transactionHash}`,
    );
    console.log("");
  }
}

main().catch(console.error);
