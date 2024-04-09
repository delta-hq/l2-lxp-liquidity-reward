import { getPositionsForAddressByPoolAtBlock } from "./sdk/positionSnapshots"

import { promisify } from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';


interface CSVRow {
    block_number: number
    timestamp: string
    user_address: string
    token_address: string
    token_symbol: string
    token_balance: string
    usd_price: string
}


const pipeline = promisify(stream.pipeline);

// Assuming you have the following functions and constants already defined
// getPositionsForAddressByPoolAtBlock, CHAINS, PROTOCOLS, AMM_TYPES, getPositionDetailsFromPosition, getLPValueByUserAndPoolFromPositions, BigNumber

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
        3542074
        // Add more blocks as needed
    ]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');

    const csvRows: CSVRow[] = [];

    for (let block of snapshotBlocks) {
        // SyncSwap Linea position snapshot
        const rows = await getPositionsForAddressByPoolAtBlock(block)
        rows.forEach((row) => csvRows.push(row as CSVRow))
    }

    // Write the CSV output to a file
    const ws = fs.createWriteStream('outputData.csv');
    write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
        console.log("CSV file has been written.");
    });
};

getData().then(() => {
    console.log("Done");
});

