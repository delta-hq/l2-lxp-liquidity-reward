import { CHAINS, PROTOCOLS, AMM_TYPES } from "./sdk/config";
import { getPositionDetailsFromPosition, getPositionsForAddressByPoolAtBlock, getTimestampAtBlock, getTradeLiquidityForAddressByPoolAtBlock } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import { write } from 'fast-csv';
import csv from 'csv-parser';
import fs from 'fs';

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: number;
  token_symbol?: string;
  usd_price: number;
};


export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputDataSchemaRow[]> => {
  return await getPoolData({ blockNumber, blockTimestamp });
}

export const getPoolData = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputDataSchemaRow[]> => {
  const allCsvRows: OutputDataSchemaRow[] = []; // Array to accumulate CSV rows for all blocks
  try {
    // const blockTimestamp = new Date(await getTimestampAtBlock(blockNumber)).toISOString();
    const positions = await getPositionsForAddressByPoolAtBlock(
      blockNumber, "", "", CHAINS.L2_CHAIN_ID, PROTOCOLS.METAVAULT, AMM_TYPES.UNISWAPV3
    );

    console.log(`Block: ${blockNumber}`);
    console.log("Positions: ", positions.length);

    // Assuming this part of the logic remains the same
    let positionsWithUSDValue = positions.map(getPositionDetailsFromPosition);
    // let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positionsWithUSDValue);

    positionsWithUSDValue.forEach((value, key) => {
      // Accumulate CSV row data
      if (value.token0DecimalValue > 0) {
        allCsvRows.push({
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: value.owner,
          token_address: value.token0.id,
          token_balance: value.token0DecimalValue,
          usd_price: 0,
        });
      }
      if (value.token1DecimalValue > 0) {
        allCsvRows.push({
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: value.owner,
          token_address: value.token1.id,
          token_balance: value.token1DecimalValue,
          usd_price: 0,
        });
      }
    });
    const liquidities = await getTradeLiquidityForAddressByPoolAtBlock(
      blockNumber, "", "", CHAINS.L2_CHAIN_ID, PROTOCOLS.METAVAULT, AMM_TYPES.TRADE
    );
    liquidities.forEach((value, key) => {
      if (value.amount > 0) {
        allCsvRows.push({
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: value.user,
          token_address: value.asset,
          token_balance: value.amount,
          usd_price: 0,
        });
      }
    });

  } catch (error) {
    console.error(`An error occurred for block ${blockNumber}:`, error);
  }
  return allCsvRows
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

  for (const block of blocks) {
      try {
          const result = await getUserTVLByBlock(block);
          for(let i = 0; i < result.length; i++){
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