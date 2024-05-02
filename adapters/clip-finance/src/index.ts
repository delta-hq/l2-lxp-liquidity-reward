import { getTimestampAtBlock, getUserBalanceSnapshotAtBlock } from "./sdk/subgraphDetails";

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

  for (const block of snapshotBlocks) {
    let snapshots = await getUserBalanceSnapshotAtBlock(block, "");

    console.log(`Block: ${block}`);
    console.log("Snapshots length:", snapshots.length);

    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

    for (const snapshot of snapshots) {
      const csvRow: CSVRow = {
        block_number: block,
        timestamp: timestamp,
        user_address: snapshot.id.substring(0, 42),
        token_address: snapshot.token,
        token_symbol: snapshot.token,
        token_balance: snapshot.balance,
        usd_price: 0
      };
      csvRows.push(csvRow);
    }
  }

  console.log("Total rows:", csvRows.length);

  return csvRows;
};
