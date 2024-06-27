import { getUserBalanceSnapshotAtBlock } from "./sdk/lib";
import fs from 'fs';
import csv from 'csv-parser';
import { write } from 'fast-csv';


export type OutputSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol?: string;
  usd_price?: number;
};

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  const snapshotBlocks: number[] = [blockNumber];

  const csvRows: OutputSchemaRow[] = [];

  for (const block of snapshotBlocks) {
    let snapshots = await getUserBalanceSnapshotAtBlock(block);

    for (const snapshot of snapshots) {
      const csvRow: OutputSchemaRow = {
        block_number: block,
        timestamp: blockTimestamp,
        user_address: snapshot.userAddress,
        token_address: snapshot.tokenAddress,
        token_balance: BigInt(snapshot.balance),
        token_symbol: '',
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
  const result = await getUserTVLByBlock(blocks[0]);
  const groupByTokenAddress = (rows: OutputSchemaRow[]): { [key: string]: bigint } => {
    return rows.reduce((acc, row) => {
      if (!acc[row.token_address]) {
        acc[row.token_address] = BigInt(0);
      }
      acc[row.token_address] += row.token_balance;
      return acc;
    }, {} as { [key: string]: bigint });
  };

  const groupedBalances = groupByTokenAddress(result);
  console.log(groupedBalances);

  await new Promise((resolve) => {
    const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
    write(result, { headers: true })
      .pipe(ws)
      .on("finish", () => {
        console.log(`CSV file has been written.`);
        resolve(true);
      });
  });

}).catch((err) => {
  console.error('Error reading CSV file:', err);
});