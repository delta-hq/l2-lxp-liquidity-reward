import * as fs from 'fs';
import { write } from "fast-csv";
import csv from 'csv-parser';

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string;
    usd_price: number;
};

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

const querySize = 1000;
const EZ_ETH_ADDRESS = "0x2416092f143378750bb29b79eD961ab195CcEea5";
const TOKEN_SYMBOL = "EZETH";
const SUBGRAPH_QUERY_URL = "https://api.goldsky.com/api/public/project_clsxzkxi8dh7o01zx5kyxdga4/subgraphs/renzo-linea-indexer/v0.11/gn";
const USER_BALANCES_QUERY = `
query BalanceQuery {
    balances(where: {block_lte: $blockNum}, first: ${querySize}, skip: $skipCount, orderBy: value, orderDirection: desc) {
      id
      user
      value
      block
      blockTimestamp
    }
  }
`;

const post = async (url: string, data: any) => {
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


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const { blockNumber, blockTimestamp } = blocks
    const csvRows: OutputDataSchemaRow[] = [];
    let skipIndex = 0;
    let latestBalances: Record<string, string[]> = {};
    while (true) {
        const responseJson = await post(SUBGRAPH_QUERY_URL, { query: USER_BALANCES_QUERY.replace("$skipCount", skipIndex.toString()).replace("$blockNum", blockNumber.toString()) });
        let rowCount = 0;
        for (const item of responseJson.data.balances) {
            let userAddress = item.user.toString();
            if (latestBalances[userAddress]) {
                if (latestBalances[userAddress][0] < item.block) {
                    latestBalances[userAddress] = [item.block.toString(), item.value.toString()];
                }
            } else {
                latestBalances[userAddress] = [item.block.toString(), item.value.toString()];
            }
            rowCount++;
        }
        if (rowCount < querySize) {
            break;
        }
        skipIndex += rowCount;
    }
    console.log(`Fetched ${skipIndex} records`);

    for (let key in latestBalances) {
        let value = latestBalances[key];
        if (value[1] != "0") {
            csvRows.push({
                block_number: blockNumber,
                timestamp: blockTimestamp,
                user_address: key,
                token_address: EZ_ETH_ADDRESS,
                token_balance: BigInt(value[1]),
                token_symbol: TOKEN_SYMBOL,
                usd_price: 0
            });
        }
    }
    return csvRows;
};

export const main = async (blocks: BlockData[]) => {
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 10; // Size of batch to trigger writing to the file
    let i = 0;

    for (const block of blocks) {
        try {
            // Retrieve data using block number and timestam
            const csvRows = await getUserTVLByBlock(block)

            // Accumulate CSV rows for all blocks
            allCsvRows.push(...csvRows);

            i++;
            console.log(`Processed block ${i}`);

            // Write to file when batch size is reached or at the end of loop
            if (i % batchSize === 0 || i === blocks.length) {
                const ws = fs.createWriteStream(`outputData.csv`, { flags: i === batchSize ? 'w' : 'a' });
                write(allCsvRows, { headers: i === batchSize ? true : false })
                    .pipe(ws)
                    .on("finish", () => {
                        console.log(`CSV file has been written.`);
                    });

                // Clear the accumulated CSV rows
                allCsvRows.length = 0;
            }
        } catch (error) {
            console.error(`An error occurred for block ${block.blockNumber}:`, error);
        }
    }
};


//main([{blockNumber: 3825017, blockTimestamp: 123456}]);



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
    const batchSize = 1000; // Size of batch to trigger writing to the file
    let i = 0;
  
    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);
            allCsvRows.push(...result);
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
  