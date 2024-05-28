import { CHAINS, PROTOCOLS } from "./sdk/config";
import {
  getAccountStatesForAddressByPoolAtBlock,
  getTimestampAtBlock,
} from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from "fs";
import csv from "csv-parser";
import { write } from "fast-csv";
import { getMarketInfos, updateBorrowBalances } from "./sdk/marketDetails";
import { bigMath } from "./sdk/abi/helpers";
import { exit } from "process";

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
    "0x43Eac5BFEa14531B8DE0B334E123eA98325de866"
  );

  const csvRows: OutputDataSchemaRow[] = [];
  const block = blocks.blockNumber;

  let states = await getAccountStatesForAddressByPoolAtBlock(
    block,
    "",
    "",
    CHAINS.LINEA,
    PROTOCOLS.LAYERBANK
  );
  states = states.filter(
    (s) => marketInfos.findIndex((lu) => lu.address == s.account) == -1
  );

  console.log(`Block: ${block}`);
  console.log("States: ", states.length);

  await updateBorrowBalances(states);

  states.forEach((state) => {
    const amount = state.lentAmount - state.borrowAmount;

    if (bigMath.abs(amount) < 1) return;

    const marketInfo = marketInfos.find(
      (mi) => mi.underlyingAddress == state.token.toLowerCase()
    );

    // Accumulate CSV row data
    csvRows.push({
      block_number: blocks.blockNumber,
      timestamp: blocks.blockTimestamp,
      user_address: state.account,
      token_address: state.token,
      token_balance: amount,
      token_symbol: marketInfo?.underlyingSymbol ?? "",
      usd_price: 0,
    });
  });

  return csvRows;
};

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on("data", (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });

  return blocks;
};

readBlocksFromCSV("hourly_blocks.csv")
  .then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        for (let i = 0; i < result.length; i++) {
          allCsvRows.push(result[i]);
        }
      } catch (error) {
        console.error(`An error occurred for block ${block}:`, error);
      }
    }
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(`outputData.csv`, { flags: "w" });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
          console.log(`CSV file has been written.`);
          resolve;
        });
    });
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });
