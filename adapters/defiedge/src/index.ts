import * as fs from "fs";

import {
  getLiquidity,
  getStrategyInfo,
  getUserDeshareBalance,
} from "@defiedge/sdk";

import { JsonRpcProvider } from "@ethersproject/providers";
import { SupportedChainId } from "@defiedge/sdk/dist/src/types";
import csv from "csv-parser";
import formatBigInt from "@defiedge/sdk/dist/src/utils/formatBigInt";
import { getERC20Contract } from "@defiedge/sdk/dist/src/contracts/index";
import parseBigInt from "@defiedge/sdk/dist/src/utils/parseBigInt";
import { write } from "fast-csv";

const fetch = require("node-fetch");

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

const LINEA_RPC = "https://rpc.linea.build"; // "https://linea.blockpi.network/v1/rpc/public";

const provider = new JsonRpcProvider(LINEA_RPC);
// Connect to wallet to sign transactions

const querySize = 1000;
const SUBGRAPH_QUERY_URL =
  "https://api.studio.thegraph.com/query/58813/defiedge-linea/version/latest";

const DEPOSITS_QUERY = /* GraphQL */ `
  {
    adds(where: { blockNumber_lte: $blockNum }, first: 1000, skip: $skipCount) {
      id
      amount0
      amount1
      blockNumber
      shares
      strategy {
        id
      }
      user {
        id
      }
    }
  }
`;

const post = async <T extends any>(url: string, data: any): Promise<T> => {
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

type Add = {
  id: string;
  amount0: string;
  amount1: string;
  blockNumber: string;
  shares: string;
  strategy: { id: string };
  user: { id: string };
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  const csvRows: OutputDataSchemaRow[] = [];
  let skipIndex = 0;
  let usersStrategy: Record<string, string[]> = {};
  const query = DEPOSITS_QUERY.replace(
    "$skipCount",
    skipIndex.toString()
  ).replace("$blockNum", blockNumber.toString());

  while (true) {
    const responseJson = await post<{ data: { adds: Add[] } }>(
      SUBGRAPH_QUERY_URL,
      { query }
    ).catch((err) => {
      console.log(err);
      return { data: { adds: [] as Add[] } };
    });

    let rowCount = 0;

    for (const item of responseJson.data.adds) {
      let userAddress = item.user.id.toString().toLowerCase();
      let strategyAddress = item.strategy.id.toString().toLowerCase();

      if (usersStrategy[userAddress]) {
        if (!usersStrategy[userAddress].includes(strategyAddress))
          usersStrategy[userAddress].push(strategyAddress);
      } else {
        usersStrategy[userAddress] = [strategyAddress];
      }

      rowCount++;
    }

    skipIndex += rowCount;

    if (rowCount < querySize) {
      break;
    }
  }

  const promiseCache: Record<
    string,
    Promise<
      [
        Awaited<ReturnType<typeof getLiquidity>>,
        Awaited<ReturnType<typeof getStrategyInfo>>,
        string
      ]
    >
  > = {};

  let latestBalances: Record<string, Record<string, string>> = {};
  const tokenSymbolMap: Record<string, string> = {};

  for (let user in usersStrategy) {
    const strategies = usersStrategy[user];
    for (let strategy of strategies) {
      try {
        if (!promiseCache[strategy])
          promiseCache[strategy] = Promise.all([
            getLiquidity(strategy, provider),
            getStrategyInfo(SupportedChainId.linea, strategy),
            getERC20Contract(strategy, provider)
              .totalSupply()
              .then(formatBigInt),
          ]);

        const [balance, [liquidity, strategyInfo, totalSupply]] =
          await Promise.all([
            getUserDeshareBalance(user, strategy, provider),
            promiseCache[strategy],
          ]);

        let userShares = !!+totalSupply ? +balance / +totalSupply : 0;

        // console.log({
        //   user,
        //   userShares,
        //   strategy,
        //   balance,
        //   liquidity,
        //   totalSupply,
        // });

        const token0 = strategyInfo.token0.id.toLowerCase();
        const token1 = strategyInfo.token1.id.toLowerCase();

        tokenSymbolMap[token0] = strategyInfo.token0.symbol;
        tokenSymbolMap[token1] = strategyInfo.token1.symbol;

        if (userShares > 0)
          latestBalances[user] = {
            [token0]: parseBigInt(
              liquidity.amount0Total * userShares,
              +strategyInfo.token0.decimals
            ).toString(),
            [token1]: parseBigInt(
              liquidity.amount1Total * userShares,
              +strategyInfo.token1.decimals
            ).toString(),
          };

        console.log(latestBalances[user]);
      } catch (e: any) {
        console.log(strategy, e.message);
      }
    }
  }

  console.log({ latestBalances });

  for (let user in latestBalances) {
    for (let token in latestBalances[user]) {
      let value = latestBalances[user][token];

      csvRows.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: user.toLowerCase(),
        token_address: token.toLowerCase(),
        token_balance: BigInt(value),
        token_symbol: tokenSymbolMap[token],
        usd_price: 0,
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
      const csvRows = await getUserTVLByBlock(block);

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
      console.error(`An error occurred for block ${block.blockNumber}:`, error);
    }
  }
};

// main([{ blockNumber: 6603301, blockTimestamp: 123456 }]);

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
    const allCsvRows: any[] = [];

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
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
