import { SNAPSHOTS_BLOCKS, OVN_CONTRACTS, LP_LYNEX, LP_LYNEX_SYMBOL, USD_PLUS_SYMBOL, USD_PLUS_LINEA, USDT_PLUS_SYMBOL, USDT_PLUS_LINEA } from "./sdk/config";
import { getLPValueByUserAndPoolFromPositions, getUserTVLByBlock, getRebaseForUsersByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';

interface CSVRow {
  block_number: string;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_balance: string;
  token_symbol: string;
}

interface BlockData {
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
  const csvRows: CSVRow[] = [];
  const csvRows_rebase: CSVRow[] = [];
  
  for (let block of blocks) {
    const timestamp = block.blockTimestamp  // new Date(await getTimestampAtBlock(block)).toISOString();
    const positions = await getUserTVLByBlock({
      blockNumber: block.blockNumber,
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
            block_number: block.blockNumber.toString(),
            timestamp: block.blockTimestamp.toString()
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

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  const ws_rebase = fs.createWriteStream('outputData_rebase.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
  write(csvRows_rebase, { headers: true }).pipe(ws_rebase).on('finish', () => {
    console.log("CSV file has been written.");
  });
});

// getData().then(() => {
//   console.log("Done");
// });

