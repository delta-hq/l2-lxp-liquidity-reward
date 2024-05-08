import { erc20Abi, zeroAddress } from "viem";
import { client } from "./client";

let holdersRetrieved = false;
const holders: Set<`0x${string}`> = new Set();

const tokenSymbol = "LUSDC";
const tokenAddress = "0x4AF215DbE27fc030F37f73109B85F421FAB45B7a";

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = blocks;
  const csvRows: OutputDataSchemaRow[] = [];

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
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: Array.from(holders)[i].toLowerCase(),
        token_address: tokenAddress.toLowerCase(),
        token_symbol: tokenSymbol,
        token_balance: balances[i].result! as bigint,
        usd_price: 1,
      });
  }

  console.log(
    `- ${tokenSymbol} holders snapshot generated at block ${blockNumber.toString()}`
  );
  return csvRows;
};
