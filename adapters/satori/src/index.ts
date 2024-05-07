import fs from 'fs';
import { write } from 'fast-csv';
import csv from 'csv-parser';
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

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: BlockData[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  
    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block.blockNumber,block.blockTimestamp);
            for(let i = 0; i < result.length; i++){
                allCsvRows.push(result[i])
            }
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
