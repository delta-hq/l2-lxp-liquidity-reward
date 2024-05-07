import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
import path from "path";

import { BlockData, OutputSchemaRow } from "./sdk/types";
import { getTimestampAtBlock, getUserBalancesAtBlock } from "./sdk/lib";

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
    token_balance: BigInt(position.balance),
    token_symbol: "",
    usd_price: 0,
  }));
};

// getData().then(() => {
//   console.log("Done");
// });

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];
  //console.log(`Reading: ${filePath}`);

  await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
          .pipe(csv({ separator: "," })) // Specify the separator as '\t' for TSV files
          .on("data", (row) => {
              //console.log(row);
              const blockNumber = parseInt(row.number, 10);
              const blockTimestamp = parseInt(row.timestamp, 10);
              //console.log(`Maybe Data ${blockNumber} ${blockTimestamp}`);
              if (!isNaN(blockNumber) && blockTimestamp) {
                  //console.log(`Valid Data`);
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

  //console.log(`blocks: ${blocks.length}`);
  return blocks;
};

readBlocksFromCSV(path.resolve(__dirname, "../hourly_blocks.csv"))
  .then(async (blocks) => {
      console.log(blocks);
      const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

      for (const block of blocks) {
          try {
              const result = await getUserTVLByBlock(block);

              // Accumulate CSV rows for all blocks
              allCsvRows.push(...result);
          } catch (error) {
              console.error(`An error occurred for block ${block}:`, error);
          }
      }
      const ws = fs.createWriteStream(`outputData.csv`, {
          flags: "w",
      });
      write(allCsvRows, {headers: true})
          .pipe(ws).on("finish", () => {
              console.log(`CSV file has been written.`);
          });
  })
  .catch((err) => {
      console.error("Error reading CSV file:", err);
});