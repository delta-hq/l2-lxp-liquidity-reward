<<<<<<< HEAD
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';
import { CHAINS, LP_LYNEX_SYMBOL, LP_LYNEX, PROTOCOLS } from "./sdk/config";
import { BlockData} from './sdk/types';
import { getLPValueByUserAndPoolFromPositions, getPositionsForAddressByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";
=======
import { SNAPSHOTS_BLOCKS, OVN_CONTRACTS, LP_LYNEX, LP_LYNEX_SYMBOL, USD_PLUS_SYMBOL, USD_PLUS_LINEA, USDT_PLUS_SYMBOL, USDT_PLUS_LINEA } from "./sdk/config";
import { getLPValueByUserAndPoolFromPositions, getUserTVLByBlock, getRebaseForUsersByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";
>>>>>>> origin/main

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
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

<<<<<<< HEAD
  return blocks;
};

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
  console.log(blocks);
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 1000; // Size of batch to trigger writing to the file
  let i = 0;

  for (let block of blocks) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block.blockNumber, "", "", CHAINS.LINEA, PROTOCOLS.OVN
    );
    
    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);

    // const timestamp = new Date(await getTimestampAtBlock(block.blockNumber)).toISOString();

    lpValueByUsers.forEach((value, key) => {
      value.forEach((lpValue) => {
        const lpValueStr = lpValue.toString();
        // Accumulate CSV row data
        allCsvRows.push({
          user_address: key,
          token_address: LP_LYNEX,
          token_symbol: LP_LYNEX_SYMBOL,
          token_balance: lpValueStr,
          block_number: block.blockNumber,
          timestamp: block.blockTimestamp
=======
const getData = async () => {
  const csvRows: CSVRow[] = [];
  const csvRows_rebase: CSVRow[] = [];
  
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
>>>>>>> origin/main
        });
      })
    });
  }

  // counting rebase by blocks range
  // [0, 100, 200] -> gonna be counted like [0, 100] + [100, 200]
  for (let [index, block] of SNAPSHOTS_BLOCKS.entries()) {
    if (!SNAPSHOTS_BLOCKS[index + 1]) continue;
    console.log(`Blocks: ${block} -> ${SNAPSHOTS_BLOCKS[index + 1]}`);

    const positionsRebaseUsd = await getRebaseForUsersByPoolAtBlock({
      blockNumberFrom: block,
      blockNumberTo: SNAPSHOTS_BLOCKS[index + 1],
      token: OVN_CONTRACTS.USDPLUS
    });

    const positionsRebaseUsdt = await getRebaseForUsersByPoolAtBlock({
      blockNumberFrom: block,
      blockNumberTo: SNAPSHOTS_BLOCKS[index + 1],
      token: OVN_CONTRACTS.USDTPLUS
    });

    console.log("positionsRebase: ", positionsRebaseUsd.size);

    // all results are counted for the END block
    const timestamp = new Date(await getTimestampAtBlock(SNAPSHOTS_BLOCKS[index + 1])).toISOString();

    positionsRebaseUsd.forEach((value, key) => {
      csvRows_rebase.push({
        user_address: key,
        token_symbol: USD_PLUS_SYMBOL,
        token_balance: value,
        token_address: USD_PLUS_LINEA,
        block_number: SNAPSHOTS_BLOCKS[index + 1].toString(),
        timestamp
      });
    });

    positionsRebaseUsdt.forEach((value, key) => {
      csvRows_rebase.push({
        user_address: key,
        token_symbol: USDT_PLUS_SYMBOL,
        token_balance: value,
        token_address: USDT_PLUS_LINEA,
        block_number: SNAPSHOTS_BLOCKS[index + 1].toString(),
        timestamp
      });
    });
  }

<<<<<<< HEAD
  await new Promise((resolve, reject) => {
    // const randomTime = Math.random() * 1000;
    // setTimeout(resolve, randomTime);
    const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
    write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
        console.log(`CSV file has been written.`);
        resolve;
        });
  });
=======
  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  const ws_rebase = fs.createWriteStream('outputData_rebase.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
  write(csvRows_rebase, { headers: true }).pipe(ws_rebase).on('finish', () => {
    console.log("CSV file has been written.");
  });
};
>>>>>>> origin/main

}).catch((err) => {
  console.error('Error reading CSV file:', err);
});

