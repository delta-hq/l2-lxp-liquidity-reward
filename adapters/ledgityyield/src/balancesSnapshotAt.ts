import { erc20Abi, zeroAddress } from "viem";
import { client } from "./client";

let holdersRetrieved = false;
const holders: Set<`0x${string}`> = new Set();

export const balancesSnapshotAt = async (
  blockNumber: bigint,
  tokenSymbol: string,
  tokenAddress: `0x${string}`
): Promise<CSVRow[]> => {
  const csvRows: CSVRow[] = [];

  // Retrieve holders' addresses list (if not already done)
  if (!holdersRetrieved) {
    // Retrieve all LUSDC transfers events
    const logs = await client.getContractEvents({
      address: tokenAddress,
      abi: erc20Abi,
      eventName: "Transfer",
      fromBlock: 211050n,
      toBlock: "latest",
    });

    logs.forEach((log) => {
      if (log.args.from && ![tokenAddress, zeroAddress].includes(log.args.from))
        holders.add(log.args.from);
      if (log.args.to && ![tokenAddress, zeroAddress].includes(log.args.to))
        holders.add(log.args.to);
    });

    // Set activities as retrieved
    holdersRetrieved = true;
  }

  // Retrieve timestamp at the given block
  const blockInfos = await client.getBlock({
    blockNumber,
  });

  // Compute all holders balances
  const reads: any[] = [];
  holders.forEach((holder) => {
    reads.push({
      abi: erc20Abi,
      functionName: "balanceOf",
      address: tokenAddress,
      args: [holder],
      blockNumber,
    });
  });
  const balances = await client.multicall({ contracts: reads });

  // Append a CSV row for each holder that has a balance at this block
  for (let i = 0; i < Array.from(holders).length; i++) {
    if (balances[i].result)
      csvRows.push({
        block_number: blockNumber.toString(),
        timestamp: new Date(Number(blockInfos.timestamp) * 1000).toISOString(),
        user_address: Array.from(holders)[i],
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        token_balance: balances[i].result!.toString(),
        usd_price: "1",
      });
  }

  console.log(
    `- ${tokenSymbol} holders snapshot generated at block ${blockNumber.toString()}`
  );
  return csvRows;
};
