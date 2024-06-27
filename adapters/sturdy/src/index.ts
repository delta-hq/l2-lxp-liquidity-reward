import { write } from "fast-csv";
import fs from "fs";
import csv from "csv-parser";
import { BlockData, getUserTVLByBlock } from "./sdk";

module.exports = {
  getUserTVLByBlock,
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

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: BlockData[]) => {
  console.log(blocks);
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 1000; // Size of batch to trigger writing to the file
  let i = 0;

  for (const block of blocks) {
    try {
      const result = await getUserTVLByBlock(block);
      for (let i = 0; i < result.length; i++) {
        allCsvRows.push(result[i])
      }
    } catch (error) {
      console.error(`An error occurred for block ${block}:`, error);
    }
  }
  await new Promise((resolve, reject) => {
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