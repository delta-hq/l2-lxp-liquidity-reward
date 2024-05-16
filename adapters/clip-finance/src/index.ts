import { getTimestampAtBlock, getUserBalanceSnapshotAtBlock } from "./sdk/subgraphDetails";
import fs from 'fs';
import csv from 'csv-parser';
import { write } from 'fast-csv';

interface CSVRow {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string;
  usd_price: number
}

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  const snapshotBlocks: number[] = [blockNumber];

  const csvRows: CSVRow[] = [];

  for (const block of snapshotBlocks) {
    let snapshots = await getUserBalanceSnapshotAtBlock(block, "");

   // const timestamp = await getTimestampAtBlock(block);

    for (const snapshot of snapshots) {
      const csvRow: CSVRow = {
        block_number: block,
        timestamp: blockTimestamp,
        user_address: snapshot.id,
        token_address: snapshot.token,
        token_balance: BigInt(snapshot.balance.toString()),
        token_symbol: snapshot.tokenSymbol,
        usd_price: 0
      };
      csvRows.push(csvRow);
    }
  }

  console.log("Total rows:", csvRows.length);

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
  const allCsvRows: any[] = []; 
  
  for (const block of blocks) {
      try {
          const result = await getUserTVLByBlock(block);
          allCsvRows.push(...result);
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