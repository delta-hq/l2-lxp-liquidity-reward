import csv from 'csv-parser';
import { write } from 'fast-csv';
import fs from 'fs';
import { AMM_TYPES, CHAINS, PROTOCOLS } from "./sdk/config";
import {
  getLPValueByUserAndPoolFromPositions,
  getPositionDetailsFromPosition,
  getPositionsForAddressByPoolAtBlock,
  getTokenPriceFromPositions,
} from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

interface OutputDataSchemaRow {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string;
  usd_price: number;
}

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks
  const positions = await getPositionsForAddressByPoolAtBlock(
    blockNumber,
    "",
    "",
    CHAINS.LINEA,
    PROTOCOLS.DODOEX,
    AMM_TYPES.DODO
  );

  console.log(`Block: ${blockNumber}`);
  console.log("Positions: ", positions.length);

  // Assuming this part of the logic remains the same
  let positionsWithUSDValue = [];
  // Add price to token
  await getTokenPriceFromPositions(positions, "linea");
  for (let position of positions) {
    const res = await getPositionDetailsFromPosition(position);
    positionsWithUSDValue.push(res);
  }
  let lpValueByUsers = await getLPValueByUserAndPoolFromPositions(
    positionsWithUSDValue
  );

  const csvRows: OutputDataSchemaRow[] = [];
  lpValueByUsers.forEach((value, owner) => {
    value.forEach((tokenBalance, tokenAddress) => {
      csvRows.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: owner,
        token_address: tokenAddress,
        token_symbol: tokenBalance.tokenSymbol,
        token_balance: tokenBalance.tokenBalance,
        usd_price: tokenBalance.usdPrice,
      });
    });
  });

  return csvRows
}

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: '\t' })) // Specify the separator as '\t' for TSV files
      .on('data', (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.block_timestamp, 10);
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