import fs from 'fs';
import { write } from 'fast-csv';
import { OutputDataSchemaRow,getUserTVLByBlock } from './sdk/subgraphDetailsV2';


interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}


export const main = async (blocks: BlockData[]) => {
    let snapshots: OutputDataSchemaRow[] = [];
    for (const { blockNumber, blockTimestamp } of blocks) {
        try {          
            snapshots = snapshots.concat(await getUserTVLByBlock(blockNumber,blockTimestamp))         
        } catch (error) {
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
    let csvRows: OutputDataSchemaRow[] = Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number, obj])).values());
    console.log(`length:---${csvRows.length}`);
    const ws = fs.createWriteStream('outputData.csv');
    write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
      console.log("CSV file has been written.");
    });
};


// main([{blockNumber:1123644,blockTimestamp:1702156132},{blockNumber:517247,blockTimestamp:1702156133}]).then(() => {
//     console.log("Done");
//   });