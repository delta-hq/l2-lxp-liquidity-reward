import { CHAINS, PROTOCOLS, SNAPSHOTS_BLOCKS } from "./sdk/config";
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
import { exit } from "process";
import { bigMath } from "./sdk/abi/helpers";

interface CSVRow {
  block_number: string;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_balance: string;
  token_symbol: string;
}

const getData = async () => {
  const marketInfos = await getMarketInfos(
    "0x1b4d3b0421ddc1eb216d230bc01527422fb93103"
  );

  const csvRows: CSVRow[] = [];

  for (let block of SNAPSHOTS_BLOCKS) {
    const { tokens, accountBorrows } =
      await getActivitiesForAddressByPoolAtBlock(
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

    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

    lpValueByUsers.forEach((value, owner) => {
      value.forEach((amount, market) => {
        if (bigMath.abs(amount) < 1) return;

        const marketInfo = marketInfos.get(market.toLowerCase());

        // Accumulate CSV row data
        csvRows.push({
          user_address: owner,
          token_address: marketInfo?.underlyingAddress ?? "",
          token_symbol: marketInfo?.underlyingSymbol ?? "",
          token_balance: (amount / BigInt(1e18)).toString(),
          block_number: block.toString(),
          timestamp,
        });
      });
    });
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });
};

getData().then(() => {
  console.log("Done");
});
