import * as fs from "fs";
import { write } from "fast-csv";
import {RPC_URLS, CHAINS, POOL_SYMBOL, SUBGRAPH_URL} from "./sdk/config";

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: number;
  token_symbol: string;
  usd_price: number;
};

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

interface Transfer {
  contractId_: string;
  from: string;
  to: string;
  value: string;
  timestamp_: string;
  block_number: number;
}

interface TransferData {
  data: {
      transfers: Transfer[];
  };
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const post = async (url: string, data: any): Promise<any> => {
  const response = await fetch(url, {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
      },
      body: JSON.stringify(data),
  });
  return await response.json();
};

const getLatestBlockNumberAndTimestamp = async () => {
  const data = await post(RPC_URLS[CHAINS.LINEA], {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: ["latest", false],
      id: 1,
  });
  const blockNumber = parseInt(data.result.number);
  const blockTimestamp = parseInt(data.result.timestamp);
  return { blockNumber, blockTimestamp };
};

function writeProgress(endBlock: number,numCompleted: number, total: number): void {
  const percentage_progress = (numCompleted / total * 100).toFixed(2);
  const filled_bar = Math.floor(parseFloat(percentage_progress) / 10);
  const empty_bar = 10 - filled_bar;
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`Block ${endBlock} - Progress:[${'#'.repeat(filled_bar)}${'-'.repeat(empty_bar)}] ${percentage_progress}%`);
}

export const getUserTVLByBlock = async (blocks: BlockData): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = blocks;
  
  const userSharesSnapshotsAtBlockData: OutputDataSchemaRow[] = [];
  let snapshotsArrays: Transfer[] = [];

  let skip = 0;
  const b_end = blockNumber;
  const timestamp_end = blockTimestamp;
  let b_start = 0;

  while (true) {
    let transferQuery = `
      query TransferQuery {
        transfers(
          skip: ${skip},
          first: 1000,
          orderBy: block_number, 
          orderDirection: asc,
          where: {
            block_number_lte: ${b_end},
            timestamp__lte: ${timestamp_end}
          }
        ) {
          contractId_
          from
          to
          value
          timestamp_
          block_number
        }
      }`;

    const responseJson = await post(SUBGRAPH_URL, { query: transferQuery });
    const transferData: TransferData = responseJson as TransferData;
    snapshotsArrays = snapshotsArrays.concat(transferData.data.transfers);

    if (transferData.data.transfers.length !== 1000) {
      break;
    }
    skip += 1000;
    if (skip > 5000) {
      skip = 0;
      b_start = snapshotsArrays[snapshotsArrays.length - 1].block_number + 1;
    }
    writeProgress(b_end, b_start, b_end);
  }

  const addressBalances: { [address: string]: { [contractId: string]: bigint } } = {};

  snapshotsArrays.forEach(transfer => {
    const { contractId_, from, to, value } = transfer;
    const bigIntValue = BigInt(value);

    if (from !== ZERO_ADDRESS) {
      if (!addressBalances[from]) {
        addressBalances[from] = {};
      }
      addressBalances[from][contractId_] = (addressBalances[from][contractId_] || BigInt(0)) - bigIntValue;
    }

    if (to !== ZERO_ADDRESS) {
      if (!addressBalances[to]) {
        addressBalances[to] = {};
      }
      addressBalances[to][contractId_] = (addressBalances[to][contractId_] || BigInt(0)) + bigIntValue;
    }
  });

  Object.entries(addressBalances).forEach(([address, balances]) => {
    Object.entries(balances).forEach(([contractId, balance]) => {
      const tokenSymbol: string = POOL_SYMBOL[contractId] || "";
      userSharesSnapshotsAtBlockData.push({
        block_number: blockNumber,
        timestamp: timestamp_end,
        user_address: address,
        token_address: contractId,
        token_symbol: tokenSymbol,
        token_balance: Number(balance),
        usd_price: 0, // Assuming USD price is not available
      });
    });
  });

  return userSharesSnapshotsAtBlockData;
};

export const main = async (blocks: BlockData[]) => {
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;

  for (const { blockNumber, blockTimestamp } of blocks) {
      try {
          // Retrieve data using block number and timestamp
          const csvRows = await getUserTVLByBlock({ blockNumber, blockTimestamp });

          // Accumulate CSV rows for all blocks
          allCsvRows.push(...csvRows);

          i++;
          console.log(`Processed block ${i}`);

          // Write to file when batch size is reached or at the end of loop
          if (i % batchSize === 0 || i === blocks.length) {
                // Write the CSV output to a file
            const ws = fs.createWriteStream('outputData.csv');
            write(allCsvRows, { headers: true }).pipe(ws).on('finish', () => {
                console.log("CSV file has been written.");
            });
            // Clear the accumulated CSV rows
            allCsvRows.length = 0;
          }

      } catch (error) {
          console.error(`An error occurred for block ${blockNumber}:`, error);
      }
  }
};

getLatestBlockNumberAndTimestamp().then(async (latestBlockData) => {
  console.log("Snapshot at:", latestBlockData);
  main([latestBlockData]);
}).catch((error) => {
  console.error('Error in fetchLatestBlockData:', error);
});
