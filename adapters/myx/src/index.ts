import {promisify} from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import {write} from 'fast-csv';

import {BlockData, OutputSchemaRow} from './sdk/types';
import {getTimestampAtBlock, getUserPositionsAtBlock} from './sdk/lib';

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

type TokenBalance = {
    token: string,
    symbol: string,
    balance: bigint,
}

export const getUserTVLByBlock = async ({blockNumber, blockTimestamp}: BlockData): Promise<OutputSchemaRow[]> => {
    const result: OutputSchemaRow[] = []

    const positions = await getUserPositionsAtBlock(blockNumber)

    const balances: Map<string, Map<string, TokenBalance>> = new Map();
    for (const position of positions) {
        let userPosition = balances.get(position.user);
        if (!userPosition) {
            userPosition = new Map<string, TokenBalance>();
        }

        {
            let tokenBalance = userPosition.get(position.token0.address);

            if (tokenBalance) {
                tokenBalance.balance += position.token0.balance;
                userPosition.set(position.token0.address, tokenBalance);
                balances.set(position.user, userPosition);
            } else {
                userPosition.set(position.token0.address, {
                    token: position.token0.address,
                    symbol: position.token0.symbol,
                    balance: position.token0.balance
                });
                balances.set(position.user,userPosition);
            }
        }

        {
            let tokenBalance = userPosition.get(position.token1.address);
            if (tokenBalance) {
                tokenBalance.balance += position.token1.balance;
                userPosition.set(position.token1.address, tokenBalance);
                balances.set(position.user, userPosition);
            } else {
                userPosition.set(position.token1.address, {
                    token: position.token1.address,
                    symbol: position.token1.symbol,
                    balance: position.token1.balance
                });
                balances.set(position.user,userPosition);
            }
        }
    }

    const timestamp = await getTimestampAtBlock(blockNumber);

    for (const [user, tokenBalances] of balances) {
        for (const [token, tokenBalance] of tokenBalances) {
            result.push({
                block_number: blockNumber,
                timestamp: timestamp,
                user_address: user,
                token_address: token,
                token_balance: tokenBalance.balance,
                token_symbol: tokenBalance.symbol,
                usd_price: 0,
            })
        }
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
                    blocks.push({blockNumber: blockNumber, blockTimestamp});
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
            for (let i = 0; i < result.length; i++) {
                allCsvRows.push(result[i])
            }
        } catch (error) {
            console.error(`An error occurred for block ${block}:`, error);
        }
    }
    await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(`outputData.csv`, {flags: 'w'});
        write(allCsvRows, {headers: true})
            .pipe(ws)
            .on("finish", () => {
                console.log(`CSV file has been written.`);
                resolve;
            });
    });

}).catch((err) => {
    console.error('Error reading CSV file:', err);
});
