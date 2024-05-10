import csv from 'csv-parser';
import fs from "fs";
import { write } from "fast-csv";

/**
 * The objective is to quantify:
 *     - TVL on Linea (size of collateral minting GRAI on Linea)
 *     - GRAI stability pool deposits on Linea
 *
 * For that, we'll be querying an existing Gravita Subgraph deployed on TheGraph.
 */

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

const GRAI_ADDRESS = "0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487";

const GRAVITA_SUBGRAPH_QUERY_URL =
  "https://api.studio.thegraph.com/query/54829/gravita-sp-lp-linea-v1/version/latest";

const PAGE_SIZE = 1_000

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

const getStabilityPoolData = async (
  blockNumber: number,
  blockTimestamp: number,
  lastId = ''
): Promise<OutputDataSchemaRow[]> => {
  const GRAVITA_STABILITY_POOL_QUERY = `
    query StabilityPoolQuery {
        poolDeposits(
            first: ${PAGE_SIZE}, 
            where: { poolName: "Gravita StabilityPool", withdrawTxHash: null, id_gt: "${lastId}" },
            block: { number: ${blockNumber} }
        ) {
            id
            user {
                id
            }
            amountA
        }
    }
  `;
  const csvRows: OutputDataSchemaRow[] = [];
  const responseJson = await post(GRAVITA_SUBGRAPH_QUERY_URL, {
    query: GRAVITA_STABILITY_POOL_QUERY,
  });
  for (const item of responseJson.data.poolDeposits) {
    csvRows.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: item.user.id,
      token_address: GRAI_ADDRESS,
      token_balance: item.amountA,
      token_symbol: "",
      usd_price: 0,
    });
  }
  if (responseJson.data.poolDeposits.length == PAGE_SIZE) {
    const lastRecord = responseJson.data.poolDeposits[responseJson.data.poolDeposits.length - 1] as any
    csvRows.push(...await getStabilityPoolData(blockNumber, blockTimestamp, lastRecord.id))
  }
  return csvRows;
};

const getVesselDepositsData = async (
  blockNumber: number,
  blockTimestamp: number,
  lastId = ''
): Promise<OutputDataSchemaRow[]> => {
  const GRAVITA_VESSELS_QUERY = `
    query VesselsQuery {
        vessels(
            first: ${PAGE_SIZE}, 
            where: { closeTimestamp: null, id_gt: "${lastId}" },
            block: { number: ${blockNumber} }
        ) {
            id
            asset
            user {
                id
            }
            updates {
                timestamp
                assetAmount
            }
        }
    }
  `;
  const csvRows: OutputDataSchemaRow[] = [];
  const responseJson = await post(GRAVITA_SUBGRAPH_QUERY_URL, {
    query: GRAVITA_VESSELS_QUERY,
  });
  for (const item of responseJson.data.vessels) {
    const sortedUpdates = item.updates.sort(
      (a: any, b: any) => b.timestamp - a.timestamp
    );
    const updatedAssetAmount = sortedUpdates[0].assetAmount;
    csvRows.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: item.user.id,
      token_address: item.asset,
      token_balance: updatedAssetAmount,
      token_symbol: "",
      usd_price: 0,
    });
  }
  if (responseJson.data.vessels.length == PAGE_SIZE) {
    const lastRecord = responseJson.data.vessels[responseJson.data.vessels.length - 1] as any
    csvRows.push(...await getVesselDepositsData(blockNumber, blockTimestamp, lastRecord.id))
  }
  return csvRows;
};

export const main = async (blocks: BlockData[]) => {
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;

  for (const { blockNumber, blockTimestamp } of blocks) {
    try {
      // Retrieve data using block number and timestamp
      const csvRowsStabilityPool = await getStabilityPoolData(
        blockNumber,
        blockTimestamp
      );
      const csvRowsVessels = await getVesselDepositsData(
        blockNumber,
        blockTimestamp
      );
      const csvRows = csvRowsStabilityPool.concat(csvRowsVessels);

      // Accumulate CSV rows for all blocks
      allCsvRows.push(...csvRows);

      i++;
      console.log(`Processed block ${i}`);

      // Write to file when batch size is reached or at the end of loop
      if (i % batchSize === 0 || i === blocks.length) {
        const ws = fs.createWriteStream(`outputData.csv`, {
          flags: i === batchSize ? "w" : "a",
        });
        write(allCsvRows, { headers: i === batchSize ? true : false })
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

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  //    Retrieve data using block number and timestamp
  const csvRowsStabilityPool = await getStabilityPoolData(
    blockNumber,
    blockTimestamp
  );
  const csvRowsVessels = await getVesselDepositsData(
    blockNumber,
    blockTimestamp
  );
  const csvRows = csvRowsStabilityPool.concat(csvRowsVessels);
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

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
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
    // const randomTime = Math.random() * 1000;
    // setTimeout(resolve, randomTime);
    const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
    write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
        console.log(`CSV file has been written.`);
        resolve;
        });
  });

    // Clear the accumulated CSV rows
  // allCsvRows.length = 0;

}).catch((err) => {
  console.error('Error reading CSV file:', err);
});