import { UserLpSnapshot,getSnapshotsForAddressAtBlock } from './sdk/subgraphDetails';



import fs from 'fs';



const getData = async () => {
    const snapshotBlocks: number[] = [
      222980,446664
  ]; 
  let snapshots: UserLpSnapshot[] = [];
  for (const block of snapshotBlocks) {
      snapshots = snapshots.concat(await getSnapshotsForAddressAtBlock(block,''))
  }

  let csvRows: UserLpSnapshot[] = Array.from(new Map(snapshots.map(obj => [obj.user_address + '|' + obj.block_number, obj])).values());;
  // Writing the JSON output to a file
  fs.writeFile('outputData.json', JSON.stringify(csvRows, null, 2), 'utf8', (err) => {
    if (err) {
      console.log("An error occurred while writing JSON Object to File.");
      return console.log(err);
    }
    console.log("JSON file has been saved.");
  });
};

getData().then(() => {
  console.log("Done");
});


