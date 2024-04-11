import fs from 'fs';
import { write } from 'fast-csv';
import { UserLpSnapshot,getSnapshotsForAddressAtBlock } from './sdk/subgraphDetails';

const getData = async () => {
    const snapshotBlocks: number[] = [
        222980,446664,522635,1123644
    ]; 
    let snapshots: UserLpSnapshot[] = [];
    for (const block of snapshotBlocks) {
        snapshots = snapshots.concat(await getSnapshotsForAddressAtBlock(block,''))
    }

    let csvRows: UserLpSnapshot[] = Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number, obj])).values());
    console.log(`length:---${csvRows.length}`);
    const ws = fs.createWriteStream('outputData.csv');
    write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
      console.log("CSV file has been written.");
    });
}
getData().then(() => {
    console.log("Done");
  });