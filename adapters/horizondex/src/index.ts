import { promisify } from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';

import { BlockData, OutputSchemaRow } from './sdk/types';
import { getV3UserPositionsAtBlock } from './sdk/lib';
import {HORIZON_SUBGRAPH_URL, HORIZON_V2_SUBGRAPH_URL} from "./sdk/config";

const pipeline = promisify(stream.pipeline);

export const getUserTVLByBlock = async ({ blockNumber, blockTimestamp }: BlockData): Promise<OutputSchemaRow[]> => {
    const result: OutputSchemaRow[] = []

    const [horizonPositions, horizonV2Positions] = await Promise.all([
        getV3UserPositionsAtBlock(blockNumber, HORIZON_SUBGRAPH_URL),
        getV3UserPositionsAtBlock(blockNumber, HORIZON_V2_SUBGRAPH_URL)
    ])

    const combinedPositions = [...horizonPositions, ...horizonV2Positions]
    const tokenSymbols: Record<string, string> = {}
    const balances: Record<string, Record<string, bigint>> = {}
    for (const position of combinedPositions) {
        balances[position.user] = balances[position.user] || {}

        if (position.token0.balance > 0n)
        balances[position.user][position.token0.address] =
            (balances?.[position.user]?.[position.token0.address] ?? 0n)
                + position.token0.balance

        if (position.token1.balance > 0n)
        balances[position.user][position.token1.address] =
            (balances?.[position.user]?.[position.token1.address] ?? 0n)
                + position.token1.balance

        tokenSymbols[position.token0.address] = position.token0.symbol
        tokenSymbols[position.token1.address] = position.token1.symbol
    }

    for (const [user, tokenBalances] of Object.entries(balances)) {
        for (const [token, balance] of Object.entries(tokenBalances)) {
            result.push({
                block_number: blockNumber,
                timestamp: blockTimestamp,
                user_address: user,
                token_address: token,
                token_balance: balance,
                token_symbol: tokenSymbols[token] || "",
                usd_price: 0
            })
        }
    }

    return result
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
