import fs from 'fs';
import { write } from 'fast-csv';
import { OutputDataSchemaRow,getUserTVLByBlock } from './sdk/subgraphDetails';
import * as swapindex from './sdk/swap/swapindex'


interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}


async function getUserTvlFromPerpetual(blocks: BlockData[]) {
    let snapshots: OutputDataSchemaRow[] = [];
    for (const {blockNumber, blockTimestamp} of blocks) {
        try {
            snapshots = snapshots.concat(await getUserTVLByBlock(blockNumber, blockTimestamp))
        } catch (error) {
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
    // Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number, obj])).values());
    snapshots = Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number, obj])).values());
    let groupedSnapshots: { [user_address: string]: OutputDataSchemaRow } = {};
    snapshots.forEach(obj => {
        const key = obj.user_address;
        if (!groupedSnapshots[key] || obj.block_number > groupedSnapshots[key].block_number) {
            groupedSnapshots[key] = obj;
        }
    });
    return groupedSnapshots;
}

async function getUserTvlFromSwap(blocks: BlockData[]) {
    let snapshots: OutputDataSchemaRow[] = [];
    for (const {blockNumber, blockTimestamp} of blocks) {
        try {
            snapshots = snapshots.concat(await swapindex.getUserTVLByBlock({blockNumber:blockNumber, blockTimestamp:blockTimestamp}))
        } catch (error) {
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
    // Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number, obj])).values());
    snapshots = Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number + '|' + obj.token_address, obj])).values());
    let groupedSnapshots: { [user_address: string]: OutputDataSchemaRow } = {};
    snapshots.forEach(obj => {
        const key = obj.user_address + obj.token_address;
        if (!groupedSnapshots[key] || obj.block_number > groupedSnapshots[key].block_number) {
            groupedSnapshots[key] = obj;
        }
    });
    return groupedSnapshots;
}

async function mergeTvl(from: {[p: string]: OutputDataSchemaRow}, to: { [p: string]: OutputDataSchemaRow }) {
    for (let s2UserAddr in from) {
        let toRow = to[s2UserAddr];
        let fromRow = from[s2UserAddr];
        if (toRow == null) {
            to[s2UserAddr] = fromRow;
        } else {
            toRow.token_balance = toRow.token_balance + fromRow.token_balance;
        }
    }
    return to;
}

export const main = async (blocks: BlockData[]) => {
    // tvl in perpetual
    let groupedSnapshots = await getUserTvlFromPerpetual(blocks);
    // tvl in swap
    let groupedSnapshots2 = await getUserTvlFromSwap(blocks);

    // merge tvl: from swap to perpetual
    groupedSnapshots = await mergeTvl(groupedSnapshots2, groupedSnapshots);

    let csvRows: OutputDataSchemaRow[] = Object.values(groupedSnapshots);
    console.log(`length:---${csvRows.length}`);
    const ws = fs.createWriteStream('outputData.csv');
    write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
      console.log("CSV file has been written.");
    });
};


// main([{blockNumber:4457308,blockTimestamp:1715394711}]).then(() => {
//     console.log("Done");
//   });