import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';

/**
 * The objective is to quantify:
 *     - Zypher Restaking TVL on Linea (currently only on Linea Sepolia)
 *     - List all users deposited balances in Zypher Restaking
 *
 * Currently, because the `linea-testnet` provided by Goldsky still points to Linea Goerli,
 * we use our own deployment of graph-node to query the relevant data.
 *
 * After the product is launched on mainnet, we will try to use the services provided by Goldsky.
 */

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: number;
  token_symbol: string;
  usd_price: number;
}

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const ZypherRestakingSubgraphEndpoints: Record<string, string> = {
  GoldskyAPI: 'https://api.goldsky.com/api/public/project_clzbcvp9w9t5k011f7hbvc17s/subgraphs/zypher-restaking/linea-mainnet/gn',
  SelfHostedGraphNode: 'https://linea-mainnet-graph.zypher.game/subgraphs/name/restaking/public',
}

const ChainlinkPriceFeeds: Record<string, string> = {
  ETH_USD: '0x0635163285c6ef5692167f18b799fb339df064f8',
}

const DEFAULT_PAGE_SIZE = 1_000

const post = async (url: string, data: any): Promise<any> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

const getAllDepositBalances = async (
  blockNumber: number,
  blockTimestamp: number,
  limit: number = DEFAULT_PAGE_SIZE,
  offset: number = 0,
  list: OutputDataSchemaRow[] = []
): Promise<OutputDataSchemaRow[]> => {
  const QUERY_USER_ASSETS = `
    query ZypherRestakingBalances {
      users(
        first: ${limit},
        skip: ${offset},
        block: { number: ${blockNumber} }
      ) {
        id
        assets(where: { balance_gt: 0 }) {
          token {
            id
            symbol
          }
          balance
        }
      }
      dataFeed(
        id: "${ChainlinkPriceFeeds.ETH_USD}",
        block: { number: ${blockNumber} }
      ) {
        value
        decimals
      }
    }
  `;

  const responseJson = await post(ZypherRestakingSubgraphEndpoints.GoldskyAPI, {
    query: QUERY_USER_ASSETS,
  });

  if (responseJson.errors) {
    throw new Error(responseJson.errors[0].message);
  }

  const {
    decimals,
    value: valueETH,
  } = responseJson.data.dataFeed;
  const priceETH = parseInt(valueETH.slice(0, 3 - decimals), 10) / 1000;

  for (const user of responseJson.data.users) {
    for (const asset of user.assets) {
      list.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: user.id,
        token_address: asset.token.id,
        token_balance: asset.balance,
        token_symbol: asset.token.symbol,
        usd_price: priceETH,
      });
    }
  }

  return responseJson.data.users.length === limit
    // recursively fetch the next page
    ? getAllDepositBalances(blockNumber, blockTimestamp, limit, offset + limit, list)
    : list;
};

export const main = async (blocks: BlockData[]) => {
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;

  for (const { blockNumber, blockTimestamp } of blocks) {
    try {
      // Retrieve data using block number and timestamp
      const csvRows = await getAllDepositBalances(
        blockNumber,
        blockTimestamp
      );

      // Accumulate CSV rows for all blocks
      allCsvRows.push(...csvRows);

      i++;
      console.log(`Processed block ${i}`);

      // Write to file when batch size is reached or at the end of loop
      if (i % batchSize === 0 || i === blocks.length) {
        const ws = fs.createWriteStream(`outputData.csv`, {
          flags: i === batchSize ? 'w' : 'a',
        });
        write(allCsvRows, { headers: i === batchSize })
          .pipe(ws)
          .on("finish", () => {
            console.log(`CSV file has been written.`);
          });

        // Clear the accumulated CSV rows
        allCsvRows.length = 0;
      }
    } catch (error) {
      console.error(`An error occurred for block ${blockNumber}:`, error);
    }
  }
};

export const getUserTVLByBlock = async (block: BlockData) => {
  const { blockNumber, blockTimestamp } = block;

  // Retrieve data using block number and timestamp
  const csvRows = await getAllDepositBalances(
    blockNumber,
    blockTimestamp
  );

  return csvRows;
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
  const allCsvRows: OutputDataSchemaRow[] = [];

  for (const block of blocks) {
      try {
          const result = await getUserTVLByBlock(block);
          allCsvRows.push(...result);
      } catch (error) {
          console.error(`An error occurred for block ${block.blockNumber}:`, error);
      }
  }

  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
    write(allCsvRows, { headers: true })
        .pipe(ws)
        .on('finish', () => {
          console.log(`CSV file has been written.`);
          resolve(true);
        });
  });

}).catch((err) => {
  console.error('Error reading CSV file:', err);
});
