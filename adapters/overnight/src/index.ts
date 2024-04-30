import { SNAPSHOTS_BLOCKS, OVN_CONTRACTS, LP_LYNEX, LP_LYNEX_SYMBOL, USD_PLUS_SYMBOL, USD_PLUS_LINEA, USDT_PLUS_SYMBOL, USDT_PLUS_LINEA } from "./sdk/config";
import { getLPValueByUserAndPoolFromPositions, getUserTVLByBlock, getRebaseForUsersByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';
import csv from 'csv-parser';

interface CSVRow {
  block_number: string;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_balance: string;
  token_symbol: string;
}

const getData = async () => {
  const csvRows: CSVRow[] = [];
  
  for (let block of SNAPSHOTS_BLOCKS) {
    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();
    const positions = await getUserTVLByBlock({
      blockNumber: block,
      blockTimestamp: Number(timestamp),
    });
    
    console.log("Positions: ", positions.length);
    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);

    lpValueByUsers.forEach((value, key) => {
      value.forEach((lpValue) => {
          const lpValueStr = lpValue.toString();
          // Accumulate CSV row data
          csvRows.push({
            user_address: key,
            token_address: LP_LYNEX,
            token_symbol: LP_LYNEX_SYMBOL,
            token_balance: lpValueStr,
            block_number: block.toString(),
            timestamp
        });
      })
    });
  }

  // counting rebase by blocks range
  // [0, 100, 200] -> gonna be counted like [0, 100] + [100, 200]
  for (let block of SNAPSHOTS_BLOCKS) {
    console.log(`Blocks: 0 -> ${block}`);

    if (block === 0) continue;

    const positionsRebaseUsd = await getRebaseForUsersByPoolAtBlock({
      blockNumber: block,
      token: OVN_CONTRACTS.USDPLUS
    });

    const positionsRebaseUsdt = await getRebaseForUsersByPoolAtBlock({
      blockNumber: block,
      token: OVN_CONTRACTS.USDTPLUS
    });

    console.log("positionsRebase: ", positionsRebaseUsd.size);

    // all results are counted for the END block
    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

    positionsRebaseUsd.forEach((value, key) => {
      csvRows.push({
        user_address: key,
        token_symbol: USD_PLUS_SYMBOL,
        token_balance: value,
        token_address: USD_PLUS_LINEA,
        block_number: block.toString(),
        timestamp
      });
    });
    positionsRebaseUsdt.forEach((value, key) => {
      csvRows.push({
        user_address: key,
        token_symbol: USDT_PLUS_SYMBOL,
        token_balance: value,
        token_address: USDT_PLUS_LINEA,
        block_number: block.toString(),
        timestamp
      });
    });
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
};

// getData().then(() => {
//   console.log("Done");
// });
export interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

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
