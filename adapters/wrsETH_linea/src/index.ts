import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";

import {
  LINEA_WRSETH,
  LINEA_WRSETH_ADDR,
  UserBalanceSubgraphEntry,
  getAllRsEthHodlers
} from "./query";

export const MULTICALL_BATCH_SIZE = 1000;

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

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = blocks;

  const allUser = await getAllRsEthHodlers(blockNumber);
  const csvRows: OutputDataSchemaRow[] = [];
  allUser.forEach((item: UserBalanceSubgraphEntry) => {
    csvRows.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: item.id,
      token_address: LINEA_WRSETH_ADDR,
      token_balance: BigInt(item.balance),
      token_symbol: LINEA_WRSETH,
      usd_price: 0
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
        console.error(
          `An error occurred for block ${JSON.stringify(block)}:`,
          error
        );
      }
    }
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream("outputData.csv", { flags: "w" });
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
