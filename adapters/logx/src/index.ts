import fetch from 'node-fetch';
import { createWriteStream, existsSync } from 'fs';
import { writeToStream } from 'fast-csv';


type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: number;
};

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const LOGX_SUBGRAPH_QUERY_URL = 'https://api.goldsky.com/api/public/project_clxspa1gpqpvl01w65jr93p57/subgraphs/LlpManager-linea/1.0.2/gn';
const PAGE_SIZE = 1000;

const post = async (url: string, data: any): Promise<any> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

const getPoolData = async (blockNumber: number, skipPage: number, blockTimestamp?: number,): Promise<OutputDataSchemaRow[]> => {
  const LOGX_POOL_QUERY = `
    query LiquidityQuery {
      addLiquidities(
            skip: ${skipPage}
            first: ${PAGE_SIZE}, 
            where: { block_number: ${blockNumber}},
        ) {
            id
            account
            token
            amount
            llpSupply
            timestamp_
        }
    }
  `;
  const csvRows: OutputDataSchemaRow[] = [];
  const responseJson = await post(LOGX_SUBGRAPH_QUERY_URL, { query: LOGX_POOL_QUERY });

  for (const item of responseJson.data.addLiquidities) {
    csvRows.push({
      block_number: blockNumber,
      timestamp: item.timestamp_,
      user_address: item.account,
      token_address: item.token,
      token_balance: item.amount,
    });
  }

  // Check if there are more records to fetch recursively
  if (responseJson.data.addLiquidities.length === PAGE_SIZE) {
    const nextPageRows = await getPoolData(blockNumber, skipPage + PAGE_SIZE, blockTimestamp);
    csvRows.push(...nextPageRows);
  }

  return csvRows;
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  // Retrieve data using block number and timestamp
  const csvRows = await getPoolData(blockNumber, 0, blockTimestamp);
  return csvRows;
};

const fetchAndWriteToCsv = async (filePath: string, blockNumber: number) => {
  const blockTimestamp = Math.floor(Date.now() / 1000); // Example timestamp (current time)

  try {
    const csvRows = await getPoolData(blockNumber, 0, blockTimestamp);

    // Check if the file already exists
    const fileExists = existsSync(filePath);

    // Create a write stream in append mode if the file exists, otherwise create a new file
    const ws = createWriteStream(filePath, { flags: 'a' });

    writeToStream(ws, csvRows, { headers: !fileExists, includeEndRowDelimiter: true }) // Include headers only if the file does not exist
      .on('finish', () => {
        console.log(`CSV file '${filePath}' has been written successfully.`);
      });

  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

// Example usage:
const outputFile = 'outputData.csv';
//Example blocknumber - 1226739
//
fetchAndWriteToCsv(outputFile, 1226739);
