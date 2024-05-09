import csv from 'csv-parser';
import fs from "fs";
import { write } from "fast-csv";
import { get } from "lodash";


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

const LYU_ADDRESS = "0xb20116eE399f15647BB1eEf9A74f6ef3b58bc951";

const LYVE_SUBGRAPH_QUERY_URL = "https://api.studio.thegraph.com/query/53783/lyve-lp-tvl/version/latest";

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

  const fetchAllData = async (query: string, variables: any, dataPath: string): Promise<any[]> => {
    let hasMore = true;
    let skip = 0;
    const allData: any[] = [];

    while (hasMore) {
        const responseJson = await post(LYVE_SUBGRAPH_QUERY_URL, {
            query: query,
            variables: { ...variables, skip: skip }
        });

        const responseData = get(responseJson, dataPath);

        if (!responseData || responseData.length === 0) {
            hasMore = false;
        } else {
            allData.push(...responseData);
            skip += variables.first; // Increase skip by 'first', assuming 'first' is the batch size
        }
    }
    return allData;
};

const getStabilityPoolData = async (
  blockNumber: number,
  blockTimestamp: number
): Promise<OutputDataSchemaRow[]> => {
  const LYVE_STABILITY_POOL_QUERY = `
      query StabilityPoolQuery($skip: Int!, $first: Int!) {
          userDeposits(skip: $skip, first: $first) {
              depositor
              updates {
                  blockNumber
                  blockTimestamp
                  newDeposit
              }
          }
      }
  `;
  const csvRows: OutputDataSchemaRow[] = [];
  const allDeposits = await fetchAllData(LYVE_STABILITY_POOL_QUERY, { first: 1000 }, 'data.userDeposits');

  const targetBlockNumber = blockNumber;

  for (const item of allDeposits) {
    try {
      const sortedUpdates = item.updates
      .filter((update: any) => update.blockNumber && update.blockNumber <= targetBlockNumber)
      .sort((a: any, b: any) => b.blockNumber - a.blockNumber);
      if( !sortedUpdates || !sortedUpdates[0]){
        continue;
    }  
      if (sortedUpdates.length > 0) {
          const mostRecentUpdate = sortedUpdates[0];
          csvRows.push({
              block_number: blockNumber,
              timestamp: blockTimestamp,
              user_address: item.depositor,
              token_address: LYU_ADDRESS,
              token_balance: mostRecentUpdate.newDeposit,
              token_symbol: "LYU",
              usd_price: 0
          });
      }
    } catch (error) {
      console.error(`getStabilityPoolData An error occurred for block ${blockNumber}:`, error);
    }
      
  }

  return csvRows;
};


const getVesselDepositsData = async (
    blockNumber: number,
    blockTimestamp: number
  ): Promise<OutputDataSchemaRow[]> => {
    const LYVE_VESSELS_QUERY = `
      query VesselQuery($skip: Int!, $first: Int!){
        vessels(
          skip: $skip, first: $first) {
          id
          _borrower
          _asset
          updates {
            _coll
            blockNumber
            blockTimestamp
          }
        }
      }
    `;
    const csvRows: OutputDataSchemaRow[] = [];
    const allDeposits = await fetchAllData(LYVE_VESSELS_QUERY, { first: 1000 }, 'data.vessels');
    const targetBlockNumber = blockNumber;

    for (const item of allDeposits) {
        try {
          const sortedUpdates = item.updates
          .filter((update: any) => update.blockNumber && update.blockNumber <= targetBlockNumber)
          .sort((a: any, b: any) => b.blockNumber - a.blockNumber);
          if( !sortedUpdates || !sortedUpdates[0]){
            continue;
        }  
            const updatedAssetAmount = sortedUpdates[0]._coll;
            csvRows.push({
                block_number: blockNumber,
                timestamp: blockTimestamp,
                user_address: item._borrower,
                token_address: item._asset,
                token_balance: updatedAssetAmount,
                token_symbol: "",
                usd_price: 0
            });
        } catch (error) {
          console.error(`getVesselDepositsData An error occurred for block ${blockNumber}:`, error);
        }
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