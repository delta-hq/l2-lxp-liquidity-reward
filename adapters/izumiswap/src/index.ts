import BigNumber from "bignumber.js";
import { CHAINS, PROTOCOLS, AMM_TYPES } from "./config/config";
import { getLPValueByUserAndPoolFromPositions, getPositionDetailsFromPosition, getPositionsForAddressByPoolAtBlock, getTimestampAtBlock } from "./utils/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { promisify } from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import { format } from 'fast-csv';
import { write } from 'fast-csv';

//Uncomment the following lines to test the getPositionAtBlock function

// const position = getPositionAtBlock(
//         0, // block number 0 for latest block
//         2, // position id
//         CHAINS.MODE, // chain id
//         PROTOCOLS.SUPSWAP, // protocol
//         AMM_TYPES.UNISWAPV3 // amm type
//     );
// position.then((position) => {
//     // print response
//     const result = getPositionDetailsFromPosition(position);
//     console.log(`${JSON.stringify(result,null, 4)}
//     `)
// });

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

interface CSVRow {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string;
  usd_price: number;
}

const pipeline = promisify(stream.pipeline);

const readBlocksFromCSV = async (filePath: string): Promise<number[]> => {
  const blocks: number[] = [];
  await pipeline(
    fs.createReadStream(filePath),
    csv(),
    async function* (source) {
      for await (const chunk of source) {
        // Assuming each row in the CSV has a column 'block' with the block number
        if (chunk.block) blocks.push(parseInt(chunk.block, 10));
      }
    }
  );
  return blocks;
};


const getData = async () => {
  const snapshotBlocks = [
    3055683
  ]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');
  
  const csvRows: CSVRow[] = [];

  for (let block of snapshotBlocks) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block, "", "", CHAINS.LINEA, PROTOCOLS.IZISWAP, AMM_TYPES.IZISWAP
    );

    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    const timestamp = await getTimestampAtBlock(block);

    // Assuming this part of the logic remains the same
    let positionsWithUSDValue = positions.map(getPositionDetailsFromPosition);
    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positionsWithUSDValue);

    lpValueByUsers.forEach((value, key) => {
      value.forEach((tokenBalance, tokenKey) => {
        // Accumulate CSV row data
        csvRows.push({
          block_number: block,
          timestamp: timestamp / 1000,
          user_address: key,
          token_address: tokenKey,
          token_symbol: tokenBalance.tokenSymbol,
          token_balance: tokenBalance.tokenBalance,
          usd_price: tokenBalance.usdPrice,
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

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks
  const positions = await getPositionsForAddressByPoolAtBlock(
    blockNumber, "", "", CHAINS.LINEA, PROTOCOLS.IZISWAP, AMM_TYPES.IZISWAP
  );

  let positionsWithUSDValue = positions.map(getPositionDetailsFromPosition);
  let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positionsWithUSDValue);
  
  const csvRows: CSVRow[] = [];
  lpValueByUsers.forEach((value, key) => {
    value.forEach((tokenBalance, tokenKey) => {
      csvRows.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: key,
        token_address: tokenKey,
        token_symbol: tokenBalance.tokenSymbol,
        token_balance: tokenBalance.tokenBalance,
        usd_price: tokenBalance.usdPrice,
      });
    });
  });
  
  return csvRows
};

getData().then(() => {
  console.log("Done");
});