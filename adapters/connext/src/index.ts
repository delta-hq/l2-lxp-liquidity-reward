import { getUserTVLByBlock, writeCsv } from "./utils";
import fs from 'fs';
import csv from 'csv-parser';
import { write } from 'fast-csv';
import { BlockData } from './utils/types';

const input = {
    blockNumber: 2954869,
    blockTimestamp: 1711044141,
}

const fileName = 'output.csv';
console.log('Getting TVL at block:', input.blockNumber);


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

readBlocksFromCSV('src/hourly_blocks.csv').then(async (blocks) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 1000; // Size of batch to trigger writing to the file
    let i = 0;

    allCsvRows.push({ block_number: 'block_number', timestamp: 'timestamp', user_address: 'user_address', token_address: 'token_address', token_balance: 'token_balance', token_symbol: 'token_symbol', usd_price: 'usd_price' });
    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);

            // Accumulate CSV rows for all blocks
            allCsvRows.push(...result);

            i++;

            // Write to file when batch size is reached or at the end of loop
            if (i % batchSize === 0 || i === blocks.length) {
                const ws = fs.createWriteStream(`outputData.csv`, { flags: i === batchSize ? 'w' : 'a' });
                write(allCsvRows, { headers: i === batchSize ? true : false })
                    .pipe(ws)
                    .on("finish", () => {
                    console.log(`CSV file has been written.`);
                    });

                // Clear the accumulated CSV rows
                allCsvRows.length = 0;
            }
        } catch (error) {
            console.error(`An error occurred for block ${block}:`, error);
        }

    }
    }).catch((err) => {
    console.error('Error reading CSV file:', err);
});
