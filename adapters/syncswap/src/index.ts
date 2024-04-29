import { getPositionsForAddressByPoolAtBlock as getSyncSwapPositionsForAddressByPoolAtBlock} from "./sdk/positionSnapshots"

import fs from 'fs';
import { write } from 'fast-csv';
import csv from 'csv-parser';


interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export const main = async (blocks: BlockData[]) => {
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 10; // Size of batch to trigger writing to the file
    let i = 0;

    for (const { blockNumber, blockTimestamp } of blocks) {
        try {
            // Retrieve data using block number and timestamp
            const csvRows = await getSyncSwapPositionsForAddressByPoolAtBlock(blockNumber)

            // Accumulate CSV rows for all blocks
            allCsvRows.push(...csvRows);

            i++;
            console.log(`Processed block ${i}`);

            // Write to file when batch size is reached or at the end of loop
            if (i % batchSize === 0 || i === blocks.length) {
                const ws = fs.createWriteStream(`outputData.csv`, { flags: i === batchSize ? 'w' : 'a' });
                write(allCsvRows, { headers: i === batchSize ? true : false })
                    .pipe(ws)
                    .on("finish", () => {
                        console.log(`CSV file has been written.`);
                    });

                // Clear the accumulated CSV rows
                allCsvRows.length = 0;
            }
        } catch (error) {
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
};


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const { blockNumber, blockTimestamp } = blocks
    return await getSyncSwapPositionsForAddressByPoolAtBlock(blockNumber)
}

// main().then(() => {
//     console.log("Done");
// });

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
  