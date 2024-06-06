import csv from 'csv-parser';
import { write } from 'fast-csv';
import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';

import { getV3UserPositionsAtTimestamp } from './sdk/lib';
import { BlockData, OutputSchemaRow } from './sdk/types';

const pipeline = promisify(stream.pipeline);

// const readBlocksFromCSV = async (filePath: string): Promise<number[]> => {
//     const blocks: number[] = [];
//     await pipeline(
//         fs.createReadStream(filePath),
//         csv(),
//         async function* (source) {
//             for await (const chunk of source) {
//                 // Assuming each row in the CSV has a column 'block' with the block number
//                 if (chunk.block) blocks.push(parseInt(chunk.block, 10));
//             }
//         }
//     );
//     return blocks;
// };

// const getData = async () => {
//     const blocks = [
//         3203675
//     ]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');

//     const csvRows: OutputSchemaRow[] = [];

//     for (const block of blocks) {
//         const timestamp = await getTimestampAtBlock(block)

//         csvRows.push(...await getUserTVLByBlock({ blockNumber: block, blockTimestamp: timestamp }))
//     }

//     // Write the CSV output to a file
//     const ws = fs.createWriteStream('outputData.csv');
//     write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
//         console.log("CSV file has been written.");
//     });
// };

export const getUserTVLByBlock = async ({ blockNumber, blockTimestamp }: BlockData): Promise<OutputSchemaRow[]> => {
    const result: OutputSchemaRow[] = []

    const positions = await getV3UserPositionsAtTimestamp(blockTimestamp)

    for (const position of positions) {
        let balance = BigInt(0)
        try {
            balance = BigInt(position.TokenBalance)
        } catch (e) {
            console.error(`Error parsing balance for position ${position}: ${e}`)
        }
        result.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            user_address: position.UserAddress,
            token_address: position.TokenAddress,
            token_balance: balance,
        })
    }

    return result
};

// getData().then(() => {
//     console.log("Done");
// });

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

