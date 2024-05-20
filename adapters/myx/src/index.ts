import {
    getPositionsForAddressByPoolAtBlock as getSyncSwapPositionsForAddressByPoolAtBlock
} from "./sdk/positionSnapshots"

import {promisify} from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import {write} from 'fast-csv';


export interface OutputDataSchemaRow {
    block_number: number;  //block_number which was given as input
    timestamp: number;     // block timestamp which was given an input, epoch format
    user_address: string;   // wallet address, all lowercase
    token_address: string;  // token address all lowercase
    token_balance: bigint;  // token balance, raw amount. Please dont divide by decimals
    token_symbol: string; //token symbol should be empty string if it is not available
    usd_price: number; //assign 0 if not available
}

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}


const pipeline = promisify(stream.pipeline);

// Assuming you have the following functions and constants already defined
// getPositionsForAddressByPoolAtBlock, CHAINS, PROTOCOLS, AMM_TYPES, getPositionDetailsFromPosition, getLPValueByUserAndPoolFromPositions, BigNumber

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

export const getUserTVLByBlock = async (blocks: BlockData) => {
    const {blockNumber, blockTimestamp} = blocks
    //    Retrieve data using block number and timestamp

    const csvRows = await getSyncSwapPositionsForAddressByPoolAtBlock(blockNumber);
    // console.log(csvRows);
    return csvRows;
};

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = [];

    // test
    // const result = await getUserTVLByBlock({blockNumber:4605383, blockTimestamp: 1715864188});
    // allCsvRows.push(...result);

    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);
            allCsvRows.push(...result);
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