import fs from "fs";
import { write } from "fast-csv";

import { BlockData, OutputSchemaRow } from "./sdk/types";
import { getTimestampAtBlock, getUserBalancesAtBlock } from "./sdk/lib";
import { parseUnits } from "viem";

const getData = async () => {
  const blocks = [3676829];
  const csvRows: OutputSchemaRow[] = [];

  for (const block of blocks) {
    const timestamp = await getTimestampAtBlock(block);

    const userBalances = await getUserTVLByBlock({
      blockNumber: block,
      blockTimestamp: timestamp,
    });

    csvRows.push(...userBalances);
  }

  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });
};

export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const positions = await getUserBalancesAtBlock(blockNumber);

  return positions.map((position) => ({
    block_number: blockNumber,
    timestamp: blockTimestamp,
    user_address: position.user,
    token_address: position.lpToken,
    token_balance: BigInt(parseUnits(position.balance, 18)),
    token_symbol: "",
    usd_price: 0,
  }));
};

getData().then(() => {
  console.log("Done");
});
