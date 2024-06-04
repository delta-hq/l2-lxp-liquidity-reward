import fs from 'fs';
import {write} from 'fast-csv';
import {OutputDataSchemaRow, queryUserTVLByBlock} from './sdk/subgraphDetails';
import csv from 'csv-parser';
import * as swapindex from './sdk/swap/swapindex'

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}


async function getUserTvlFromPerpetual(blocks: BlockData[]) {
    let snapshots: OutputDataSchemaRow[] = [];
    let groupedSnapshots: { [user_address: string]: OutputDataSchemaRow } = {};
    for (const {blockNumber, blockTimestamp} of blocks) {
        try {
            snapshots = snapshots.concat(await queryUserTVLByBlock(blockNumber, blockTimestamp))
            snapshots = Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number, obj])).values());
            snapshots.forEach(obj => {
                const key = obj.user_address + obj.token_address;
                if (!groupedSnapshots[key] || obj.block_number > groupedSnapshots[key].block_number) {
                    groupedSnapshots[key] = obj;
                }
            });
            for (const key in groupedSnapshots) {
                groupedSnapshots[key].block_number = blockNumber;
                groupedSnapshots[key].timestamp = blockTimestamp;
                if(groupedSnapshots[key].token_balance <= 0){
                    delete groupedSnapshots[key];
                }
            }
        } catch (error) {
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
    return groupedSnapshots;
}

async function getUserTvlFromSwap(blocks: BlockData[]) {
    let snapshots: OutputDataSchemaRow[] = [];
    let groupedSnapshots: { [user_address: string]: OutputDataSchemaRow } = {};
    for (const {blockNumber, blockTimestamp} of blocks) {
        try {
            snapshots = snapshots.concat(await swapindex.getUserTVLByBlock({
                blockNumber: blockNumber,
                blockTimestamp: blockTimestamp
            }))
            snapshots = Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number + '|' + obj.token_address, obj])).values());
            snapshots.forEach(obj => {
                const key = obj.user_address + obj.token_address;
                if (!groupedSnapshots[key] || obj.block_number > groupedSnapshots[key].block_number) {
                    groupedSnapshots[key] = obj;
                }
            });
            for (const key in groupedSnapshots) {
                groupedSnapshots[key].block_number = blockNumber;
                groupedSnapshots[key].timestamp = blockTimestamp;

            }
        } catch (error) {
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }

    return groupedSnapshots;
}

async function mergeTvl(from: { [p: string]: OutputDataSchemaRow }, to: { [p: string]: OutputDataSchemaRow }) {
    for (let s2UserAddr in from) {
        let toRow = to[s2UserAddr];
        let fromRow = from[s2UserAddr];
        if (toRow == null) {
            to[s2UserAddr] = fromRow;
        } else {
            toRow.token_balance = BigInt(toRow.token_balance) + BigInt(fromRow.token_balance);
        }
    }
    return to;
}

export const queryAllByBloks = async (blocks: BlockData[]) => {
    // tvl in perpetual
    let groupedSnapshots = await getUserTvlFromPerpetual(blocks);
    // tvl in swap
    let groupedSnapshots2 = await getUserTvlFromSwap(blocks);

    // merge tvl: from swap to perpetual
    groupedSnapshots = await mergeTvl(groupedSnapshots2, groupedSnapshots);
    let csvRows: OutputDataSchemaRow[] = Object.values(groupedSnapshots);
    return csvRows;
    /*console.log(`length:---${csvRows.length}`);
    const ws = fs.createWriteStream('outputData.csv');
    write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
      console.log("CSV file has been written.");
    });*/
};

// 4457308
export const getUserTVLByBlock = async (blocks: BlockData) => {
    const {blockNumber, blockTimestamp} = blocks
    return await queryAllByBloks([blocks])
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
    let allCsvRows: any[] = [];

    let csvRows: OutputDataSchemaRow[] = await queryAllByBloks(blocks);
    console.log(`length:---${csvRows.length}`);
    await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(`outputData.csv`, {flags: 'w'});
        write(csvRows, {headers: true})
            .pipe(ws)
            .on("finish", () => {
                console.log(`CSV file has been written.`);
                resolve;
            });
    });

}).catch((err) => {
    console.error('Error reading CSV file:', err);
});

// main([{blockNumber:669512,blockTimestamp:1715394711}]).then(() => {
//     console.log("Done");
//   });