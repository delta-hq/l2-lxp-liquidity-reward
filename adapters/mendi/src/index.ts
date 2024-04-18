import { CHAINS, PROTOCOLS } from "./sdk/config";
import {
  getLPValueByUserAndPoolFromActivities,
  getActivitiesForAddressByPoolAtBlock,
  getTimestampAtBlock,
} from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from "fs";
import { write } from "fast-csv";
import { getMarketInfos } from "./sdk/marketDetails";
import { bigMath } from "./sdk/abi/helpers";

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const marketInfos = await getMarketInfos(
    "0x1b4d3b0421ddc1eb216d230bc01527422fb93103"
  );

  const csvRows: OutputDataSchemaRow[] = [];
  const block = blocks.blockNumber;

  const { tokens, accountBorrows } = await getActivitiesForAddressByPoolAtBlock(
    block,
    "",
    "",
    CHAINS.LINEA,
    PROTOCOLS.MENDI
  );

  console.log(`Block: ${block}`);
  console.log("Tokens: ", tokens.length);
  console.log("Account Borrows: ", accountBorrows.length);

  let lpValueByUsers = getLPValueByUserAndPoolFromActivities(
    tokens,
    accountBorrows
  );

  const timestamp = await getTimestampAtBlock(block);

  lpValueByUsers.forEach((value, owner) => {
    value.forEach((amount, market) => {
      if (bigMath.abs(amount) < 1) return;

      const marketInfo = marketInfos.get(market.toLowerCase());

      // Accumulate CSV row data
      csvRows.push({
        block_number: block,
        timestamp: timestamp,
        user_address: owner,
        token_address: marketInfo?.underlyingAddress ?? "",
        token_balance: amount / BigInt(1e18),
        token_symbol: marketInfo?.underlyingSymbol ?? "",
        usd_price: 0,
      });
    });
  });

  // Write the CSV output to a file
  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });

  return csvRows;
};
