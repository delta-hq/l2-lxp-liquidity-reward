import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';
import { CHAINS, LP_LYNEX_SYMBOL, LP_LYNEX, PROTOCOLS } from "./sdk/config";
import { BlockData} from './sdk/types';
import { getLPValueByUserAndPoolFromPositions, getPositionsForAddressByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";

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
        });
      });
    });
  }

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

}).catch((err) => {
  console.error('Error reading CSV file:', err);
});

