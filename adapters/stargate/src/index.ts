import fs from "fs";
import csv from "csv-parser";
import path from "path";

import { BlockData } from "./sdk/types";
import { PositionsStream } from "./sdk/lib";

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

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

  return blocks;
};

readBlocksFromCSV(path.resolve(__dirname, "../hourly_blocks.csv"))
  .then(async (blocks) => {
    const csvWriteStream = fs.createWriteStream(`outputData.csv`, {
      flags: "w",
    });

    csvWriteStream.write(
      "block_number,timestamp,user_address,token_address,token_balance,token_symbol,usd_price\n"
    );

    for (const block of blocks) {
      try {
        const poisitionsStream = new PositionsStream(block);

        poisitionsStream.pipe(csvWriteStream);
      } catch (error) {
        console.error(
          `An error occurred for block ${block.blockNumber}:`,
          error
        );
      }
    }
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });
