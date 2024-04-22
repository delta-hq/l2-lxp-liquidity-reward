import { getUserTVLByBlock, writeCsv } from "./utils";
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';

const input = {
    blockNumber: 2954869,
    blockTimestamp: 1711044141,
}

const fileName = 'output.csv';
console.log('Getting TVL at block:', input.blockNumber);

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
  }
  
  interface CSVRow {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: string;
    token_symbol: string;
    usd_price: number;
  }

// returns all user balances at the input block by looking at the latest
// balance for each user and token on the subgraph, capped at given block.
getUserTVLByBlock(input).then((data) => {
    if (data.length === 0) {
        console.log("no data to write to file");
        return;
    }
    writeCsv(data, fileName).then(() => {
        console.log('CSV written to file:', fileName);
    })
});

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
  
    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);
            // Accumulate CSV rows for all blocks
            allCsvRows.push(...result);
            // console.log(`Processed block ${i}`);
            // Write to file when batch size is reached or at the end of loop
            // if (i % batchSize === 0 || i === blocks.length) {
            // }
        } catch (error) {
            console.error(`An error occurred for block ${block}:`, error);
        }
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
  
      // Clear the accumulated CSV rows
    // allCsvRows.length = 0;
  
  }).catch((err) => {
    console.error('Error reading CSV file:', err);
  });
  