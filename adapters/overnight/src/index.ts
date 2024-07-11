import { SNAPSHOTS_BLOCKS } from "./sdk/config";
import { getUserTVLByBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';
import csv from 'csv-parser';

export interface CSVRow {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string;
  usd_price?: number;
}

export interface BlockData {
  blockTimestamp: number;
  blockNumber: number
}

const getData = async () => {
  let csvRows: CSVRow[] = [];
  
  for (let block of SNAPSHOTS_BLOCKS) {
    const timestamp = await getTimestampAtBlock(block);

    const list = await getUserTVLByBlock({
      blockNumber: block,
      blockTimestamp: timestamp,
    });

    csvRows = csvRows.concat(list)
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
};

getData().then(() => {
  console.log("Done");
});

// const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
//   const blocks: BlockData[] = [];

//   await new Promise<void>((resolve, reject) => {
//     fs.createReadStream(filePath)
//       .pipe(csv()) // Specify the separator as '\t' for TSV files
//       .on('data', (row) => {
//         const blockNumber = parseInt(row.number, 10);
//         const blockTimestamp = parseInt(row.timestamp, 10);
//         if (!isNaN(blockNumber) && blockTimestamp) {
//           blocks.push({ blockNumber: blockNumber, blockTimestamp });
//         }
//       })
//       .on('end', () => {
//         resolve();
//       })
//       .on('error', (err) => {
//         reject(err);
//       });
//   });

//   return blocks;
// };

// readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: BlockData[]) => {
//   console.log(blocks);
//   const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
//   let i = 0;

//   for (const block of blocks) {
//       try {
//           const result = await getUserTVLByBlock(block);
//           allCsvRows.push(...result);
//       } catch (error) {
//           console.error(`An error occurred for block ${block}:`, error);
//       }
//   }
//   await new Promise((resolve, reject) => {
//     const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
//     write(allCsvRows, { headers: true })
//         .pipe(ws)
//         .on("finish", () => {
//         console.log(`CSV file has been written.`);
//         resolve;
//         });
//   });
// }).catch((err) => {
//   console.error('Error reading CSV file:', err);
// });
