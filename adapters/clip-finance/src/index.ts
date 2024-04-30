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
  usd_price: number
}

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  const snapshotBlocks: number[] = [blockNumber];

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
        usd_price: 0
      };
      csvRows.push(csvRow);
    }
  }

  console.log("Total rows:", csvRows.length);

  return csvRows;
};
