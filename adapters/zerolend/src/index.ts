import { write } from "fast-csv";
import fs from "fs";
import csv from "csv-parser";
import { BlockData } from "./sdk/types";
import { getUserTVLByBlock } from "./sdk/tvl";
import { getUserStakeByBlock } from "./sdk/stake";
import { getUserLPByBlock } from "./sdk/lp";

module.exports = {
  getUserTVLByBlock,
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
  .then(async (blocks: BlockData[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

    for (const block of blocks) {
      try {
        const resultTvl = await getUserTVLByBlock(block);
        allCsvRows.push(...resultTvl);

        const resultStake = await getUserStakeByBlock(block);
        allCsvRows.push(...resultStake);

        const resultLp = await getUserLPByBlock(block);
        allCsvRows.push(...resultLp);
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
