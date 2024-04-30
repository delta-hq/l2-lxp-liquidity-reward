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
import csv from 'csv-parser';
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

  lpValueByUsers.forEach((value, owner) => {
    value.forEach((amount, market) => {
      if (bigMath.abs(amount) < 1) return;

      const marketInfo = marketInfos.get(market.toLowerCase());

      // Accumulate CSV row data
      csvRows.push({
        block_number: blocks.blockTimestamp,
        timestamp: blocks.blockTimestamp,
        user_address: owner,
        token_address: marketInfo?.underlyingAddress ?? "",
        token_balance: amount / BigInt(1e18),
        token_symbol: marketInfo?.underlyingSymbol ?? "",
        usd_price: 0,
      });
    });
  });

  // Write the CSV output to a file
  // const ws = fs.createWriteStream("outputData.csv");
  // write(csvRows, { headers: true })
  //   .pipe(ws)
  //   .on("finish", () => {
  //     console.log("CSV file has been written.");
  //   });

  return csvRows;
};


const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on('data', (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      });
  });

  return blocks;
};


readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
  console.log(blocks);
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 1000; // Size of batch to trigger writing to the file
  let i = 0;

  for (const block of blocks) {
      try {
          const result = await getUserTVLByBlock(block);
          // Accumulate CSV rows for all blocks
          allCsvRows.push(...result);
      } catch (error) {
          console.error(`An error occurred for block ${block}:`, error);
      }
  }
  await new Promise((resolve, reject) => {
    // const randomTime = Math.random() * 1000;
    // setTimeout(resolve, randomTime);
    const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
    write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
        console.log(`CSV file has been written.`);
        resolve;
        });
  });
}).catch((err) => {
  console.error('Error reading CSV file:', err);
});
