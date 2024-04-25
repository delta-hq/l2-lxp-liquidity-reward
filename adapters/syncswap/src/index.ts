import { getPositionsForAddressByPoolAtBlock as getSyncSwapPositionsForAddressByPoolAtBlock} from "./sdk/positionSnapshots"

import fs from 'fs';
import { write } from 'fast-csv';





interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export const main = async (blocks: BlockData[]) => {
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 10; // Size of batch to trigger writing to the file
    let i = 0;

    for (const { blockNumber, blockTimestamp } of blocks) {
        try {
            // Retrieve data using block number and timestamp
            const csvRows = await getSyncSwapPositionsForAddressByPoolAtBlock(blockNumber)

            // Accumulate CSV rows for all blocks
            allCsvRows.push(...csvRows);

            i++;
            console.log(`Processed block ${i}`);

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
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
};


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const { blockNumber, blockTimestamp } = blocks
    return await getSyncSwapPositionsForAddressByPoolAtBlock(blockNumber)
}

// main().then(() => {
//     console.log("Done");
// });
