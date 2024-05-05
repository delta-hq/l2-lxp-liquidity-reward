import fs from 'fs';
import { write } from 'fast-csv';

import { BlockData, OutputSchemaRow } from './sdk/types';
import {
  getTimestampAtBlock,
  getUserPositionsAtBlock,
} from './sdk/lib';


const getData = async () => {
  const block = 1262060; 
  const timestamp = await getTimestampAtBlock(block);
  const csvRows = await getUserTVLByBlock({
    blockNumber: block,
    blockTimestamp: timestamp,
  })

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true })
    .pipe(ws)
    .on('finish', () => {
      console.log('CSV file has been written.');
    });
};

export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const res = await getUserPositionsAtBlock(blockNumber)
  return res.map(item => ({ ...item, block_number: blockNumber, timestamp: blockTimestamp }))

};

getData().then(() => {
  console.log('Done');
});
