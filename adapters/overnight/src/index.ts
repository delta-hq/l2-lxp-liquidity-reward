import { CHAINS, LP_LYNEX_SYMBOL, LP_LYNEX, PROTOCOLS, SNAPSHOTS_BLOCKS } from "./sdk/config";
import { getLPValueByUserAndPoolFromPositions, getPositionsForAddressByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";

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
    const positions = await getPositionsForAddressByPoolAtBlock(
      block, "", "", CHAINS.LINEA, PROTOCOLS.OVN
    );
    
    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);

    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

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

export const getUserTVLByBlock = async ({ blockNumber, blockTimestamp }: BlockData): Promise<OutputSchemaRow[]> => {
  for (let block of SNAPSHOTS_BLOCKS) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block, "", "", CHAINS.LINEA, PROTOCOLS.OVN
    );
    
    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);

    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

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
      });
    });
  }
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