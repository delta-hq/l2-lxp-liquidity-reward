import { write } from "fast-csv";
import fs from "fs";
import csv from "csv-parser";
import { BlockData, getUserTVLByBlock } from "./sdk";

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: "\t" })) // Specify the separator as '\t' for TSV files
      .on("data", (row: any) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.block_timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  return blocks;
};

readBlocksFromCSV("block_numbers.tsv")
  .then(async (blocks) => {
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 10; // Size of batch to trigger writing to the file
    let i = 0;

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);

        // Accumulate CSV rows for all blocks
        allCsvRows.push(...result);

        i++;
        console.log(`Processed block ${i}`);

        // Write to file when batch size is reached or at the end of loop
        if (i % batchSize === 0 || i === blocks.length) {
          const ws = fs.createWriteStream(`outputData.csv`, {
            flags: i === batchSize ? "w" : "a",
          });
          write(allCsvRows, { headers: i === batchSize ? true : false })
            .pipe(ws)
            .on("finish", () => {
              console.log(`CSV file has been written.`);
            });

          // Clear the accumulated CSV rows
          allCsvRows.length = 0;
        }
      } catch (error) {
        console.error(`An error occurred for block ${block}:`, error);
      }
    }
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });

module.exports = {
  getUserTVLByBlock,
};
