import fs from "fs";
import { write } from "fast-csv";
import { getTimestampAtBlock, getUserBalanceSnapshotAtBlock } from "./sdk/subgraphDetails";
import { ASSETS, CHAINS } from "./sdk/config";

interface CSVRow {
  block_number: number;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_symbol: string;
  token_balance: number;
}

const getData = async () => {
  const snapshotBlocks: number[] = [2713644, 3019240];

  const csvRows: CSVRow[] = [];

  let assetAddress = ASSETS[CHAINS.LINEA].address;
  let assetSymbol = ASSETS[CHAINS.LINEA].symbol;

  for (const block of snapshotBlocks) {
    let snapshots = await getUserBalanceSnapshotAtBlock(block, "");

    console.log(`Block: ${block}`);
    console.log("Snapshots length:", snapshots.length);

    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

    for (const snapshot of snapshots) {
      const csvRow: CSVRow = {
        block_number: block,
        timestamp: timestamp,
        user_address: snapshot.id,
        token_address: assetAddress,
        token_symbol: assetSymbol,
        token_balance: snapshot.balance,
      };
      csvRows.push(csvRow);
    }
  }

  console.log("Total rows:", csvRows.length);

  // Write the CSV output to a file
  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });
};

getData().then(() => {
  console.log("Done");
});
