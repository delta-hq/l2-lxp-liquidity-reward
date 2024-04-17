import { promisify } from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';

import { BlockData, OutputSchemaRow } from './sdk/types';
import {
  getTimestampAtBlock,
  getV3UserPositionsAtBlock,
} from './sdk/lib';

const pipeline = promisify(stream.pipeline);

const readBlocksFromCSV = async (
  filePath: string,
): Promise<number[]> => {
  const blocks: number[] = [];
  await pipeline(
    fs.createReadStream(filePath),
    csv(),
    async function* (source) {
      for await (const chunk of source) {
        // Assuming each row in the CSV has a column 'block' with the block number
        if (chunk.block) blocks.push(parseInt(chunk.block, 10));
      }
    },
  );
  return blocks;
};

const getData = async () => {
  const blocks = [3759558]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');

  const csvRows: OutputSchemaRow[] = [];

  for (const block of blocks) {
    const timestamp = await getTimestampAtBlock(block);

    csvRows.push(
      ...(await getUserTVLByBlock({
        blockNumber: block,
        blockTimestamp: timestamp,
      })),
    );
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true })
    .pipe(ws)
    .on('finish', () => {
      console.log('CSV file has been written.');
    });
};

export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const result: OutputSchemaRow[] = [];

  const v3Positions = await getV3UserPositionsAtBlock(blockNumber);

  const combinedPositions = v3Positions;
  const balances: Record<string, Record<string, bigint>> = {};
  for (const position of combinedPositions) {
    balances[position.user] = balances[position.user] || {};

    if (position.token0.balance > 0n)
      balances[position.user][position.token0.address] =
        (balances?.[position.user]?.[position.token0.address] ?? 0n) +
        position.token0.balance;

    if (position.token1.balance > 0n)
      balances[position.user][position.token1.address] =
        (balances?.[position.user]?.[position.token1.address] ?? 0n) +
        position.token1.balance;
  }

  for (const [user, tokenBalances] of Object.entries(balances)) {
    for (const [token, balance] of Object.entries(tokenBalances)) {
      result.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: user,
        token_address: token,
        token_balance: balance,
      });
    }
  }

  return result;
};

getData().then(() => {
  console.log('Done');
});
