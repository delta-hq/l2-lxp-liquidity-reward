import { promisify } from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}
interface entriesData {
  user_address: string;
  token_address: string;
  token_balance: string;
}
interface callbackData {
  linea_block_number: string;
  linea_block_timestamp: string;
  entries: Array<entriesData>;
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

export const getUserTVLByBlock = async (data: BlockData) => {
  console.log("downloading...");
  const { blockNumber, blockTimestamp } = data;
  const csvRows: OutputDataSchemaRow[] = [];
  const res = await fetch(
    `https://cbridge-prod2.celer.app/v1/getLineaLiquiditySnapshot?linea_block_number=${blockNumber}&linea_block_timestamp=${blockTimestamp}`
  );
  const resData: callbackData = (await res.json()) as callbackData;
  resData.entries?.forEach((item: any) => {
    csvRows.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: "0x" + item.user_address,
      token_address: item.token_address,
      token_balance: item.token_balance,
      token_symbol: "",
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
          // console.log(`Processed block ${i}`);
          // Write to file when batch size is reached or at the end of loop
          // if (i % batchSize === 0 || i === blocks.length) {
          // }
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

    // Clear the accumulated CSV rows
  // allCsvRows.length = 0;

}).catch((err) => {
  console.error('Error reading CSV file:', err);
});