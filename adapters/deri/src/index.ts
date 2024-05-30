import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

type Position = {
  user: string;
  bToken: string;
  bAmount: bigint;
  tokenB0: string;
  b0Amount: bigint;
};

// const LINEA_RPC = "https://rpc.linea.build";

const DERI_SUBGRAPH_QUERY_URL = "https://v4dh.deri.io/graphql";

// const post = async (url: string, data: any): Promise<any> => {
//   const response = await fetch(url, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Accept: "application/json",
//     },
//     body: JSON.stringify(data),
//   });
//   return await response.json();
// };

// const getLatestBlockNumberAndTimestamp = async () => {
//   const data = await post(LINEA_RPC, {
//     jsonrpc: "2.0",
//     method: "eth_getBlockByNumber",
//     params: ["latest", false],
//     id: 1,
//   });
//   const blockNumber = parseInt(data.result.number);
//   const blockTimestamp = parseInt(data.result.timestamp);
//   return { blockNumber, blockTimestamp };
// };

const getLTokenPositions = async (blockNumber: number): Promise<Position[]> => {
  let skip = 0;
  let fetchNext = true;
  let result: Position[] = [];
  while (fetchNext) {
    let query = `{
            adjustedLTokenPositions(where: {blockNumber: ${blockNumber}, first: 5000, skip:${skip}) {
              user
              bToken
              tokenB0
              bAmount
              b0Amount
            }
          }`;

    let response = await fetch(DERI_SUBGRAPH_QUERY_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let positions = data.data.adjustedLTokenPositions;
    for (let i = 0; i < positions.length; i++) {
      let position = positions[i];
      result.push(position);
    }
    if (positions.length < 5000) {
      fetchNext = false;
    } else {
      skip += 5000;
    }
  }
  return result;
};

const getPTokenPositions = async (blockNumber: number): Promise<Position[]> => {
  let skip = 0;
  let fetchNext = true;
  let result: Position[] = [];
  while (fetchNext) {
    let query = `{
            adjustedPTokenPositions(where: {blockNumber: ${blockNumber}, first: 5000, skip:${skip}}) {
              user
              bToken
              tokenB0
              bAmount
              b0Amount
            }
          }`;

    let response = await fetch(DERI_SUBGRAPH_QUERY_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let positions = data.data.adjustedPTokenPositions;
    for (let i = 0; i < positions.length; i++) {
      let position = positions[i];
      result.push(position);
    }
    if (positions.length < 5000) {
      fetchNext = false;
    } else {
      skip += 5000;
    }
  }
  return result;
};

function convertPositionsToCsvRows(
  positions: Position[],
  blockNumber: number,
  blockTimestamp: number
): OutputDataSchemaRow[] {
  const mergedRowsMap = new Map<string, OutputDataSchemaRow>();

  positions.forEach((position) => {
    const bAmount = BigInt(position.bAmount);
    const b0Amount = BigInt(position.b0Amount);
    if (bAmount > BigInt(0)) {
      const key = `${position.user}-${position.bToken}`;
      const existingRow = mergedRowsMap.get(key);

      if (existingRow) {
        mergedRowsMap.set(key, {
          ...existingRow,
          token_balance: existingRow.token_balance + bAmount,
        });
      } else {
        mergedRowsMap.set(key, {
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: position.user,
          token_address: position.bToken,
          token_balance: bAmount,
          token_symbol: "",
          usd_price: 0,
        });
      }
    }

    if (b0Amount > BigInt(0)) {
      const keyB0 = `${position.user}-${position.tokenB0}`;
      const existingRowB0 = mergedRowsMap.get(keyB0);

      if (existingRowB0) {
        mergedRowsMap.set(keyB0, {
          ...existingRowB0,
          token_balance: existingRowB0.token_balance + b0Amount,
        });
      } else {
        mergedRowsMap.set(keyB0, {
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: position.user,
          token_address: position.tokenB0,
          token_balance: b0Amount,
          token_symbol: "",
          usd_price: 0,
        });
      }
    }
  });

  return Array.from(mergedRowsMap.values());
}

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

export const main = async (blocks: BlockData[]) => {
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;
  let started = false;

  for (const { blockNumber, blockTimestamp } of blocks) {
    try {
      // Retrieve data using block number and timestamp
      const lTokenPositions = await getLTokenPositions(blockNumber);
      const pTokenPositions = await getPTokenPositions(blockNumber);
      const csvRows = convertPositionsToCsvRows(
        lTokenPositions.concat(pTokenPositions),
        blockNumber,
        blockTimestamp
      );

      // Accumulate CSV rows for all blocks
      allCsvRows.push(...csvRows);

      i++;
      console.log(`Processed block ${blockNumber}`);

      // Write to file when batch size is reached or at the end of loop
      if (i % batchSize === 0 || i === blocks.length) {
        const ws = fs.createWriteStream(`outputData.csv`, {
          flags: started ? "a" : "w",
        });
        write(allCsvRows, { headers: !started })
          .pipe(ws)
          .on("finish", () => {
            console.log(`CSV file has been written.`);
          });
        started = true;

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
  const lTokenPositions = await getLTokenPositions(blockNumber);
  const pTokenPositions = await getPTokenPositions(blockNumber);
  const csvRows = convertPositionsToCsvRows(
    lTokenPositions.concat(pTokenPositions),
    blockNumber,
    blockTimestamp
  );
  return csvRows;
};

// const input = {
//   blockNumber: 3036578,
//   blockTimestamp: 1711004285,
// };

// main([input]).then(() => {
//   console.log("Done");
// });

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on("data", (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });

  return blocks;
};

readBlocksFromCSV("hourly_blocks.csv")
  .then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        // Accumulate CSV rows for all blocks
        allCsvRows.push(...result);
      } catch (error) {
        console.error(`An error occurred for block ${block}:`, error);
      }
    }
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(`outputData.csv`, { flags: "w" });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
          console.log(`CSV file has been written.`);
          resolve;
        });
    });
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });
