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

    const timestamp = await getTimestampAtBlock(block);

    for (const snapshot of snapshots) {
      const csvRow: CSVRow = {
        block_number: block,
        timestamp: timestamp,
        user_address: snapshot.id,
        token_address: snapshot.token,
        token_symbol: snapshot.tokenSymbol,
        token_balance: BigInt(snapshot.balance.toString()),
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
      .pipe(csv({ separator: ',' })) // Specify the separator as ',' for csv files
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

readBlocksFromCSV('hourly_blocks.csv')
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
        console.error(`An error occurred for block ${block}:`, error);
      }

    }
  })
  .catch((err) => {
    console.error('Error reading CSV file:', err);
  });
