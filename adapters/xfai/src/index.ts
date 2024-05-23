import { Client } from "pg";
import {
  CHAIN_ID,
  LIQUIDITY_EVENTS_DB,
  RPC_URL,
  WETH,
  XFAI_FACTORY,
  XFAI_POOL_INIT,
} from "./config";
import { keccak256, pack } from "@ethersproject/solidity";
import { uniq } from "lodash";
import { multicall } from "./sdk/mutlicall";
import { IXfaiPool__factory } from "./sdk/factories/IXfaiPool__factory";
import { getCreate2Address } from "ethers/lib/utils";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { write } from "@fast-csv/format";
import csv from "csv-parser";

import fs from "fs";
function getPoolAddressFromTokenAddress(tokenAddress: string): string {
  return getCreate2Address(
    XFAI_FACTORY,
    keccak256(["bytes"], [pack(["address"], [tokenAddress])]),
    XFAI_POOL_INIT
  );
}

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

async function getDBConnection() {
  const client = new Client(LIQUIDITY_EVENTS_DB);
  await client.connect();
  return client;
}

async function getProvider() {
  const provider = new StaticJsonRpcProvider(RPC_URL, CHAIN_ID);
  await provider.ready;
  return provider;
}

type ChangedLiquidity = {
  owner: string;
  token: string;
  liquidity: number;
  timestamp: number;
  blockNumber: bigint;
};

export async function getUserTVLByBlock(
  block: BlockData
): Promise<OutputDataSchemaRow[]> {
  const client = await getDBConnection();
  const provider = await getProvider();

  const liquidities = await client.query<ChangedLiquidity>({
    text: `
    SELECT owner,
    token,
    max("blockNumber")   as "blockNumber",
    (max("date") / 1000) as "timestamp",
    sum(liquidity)       as liquidity
    FROM "LiquidityTrace"
    WHERE     "blockNumber" <= $1 
          AND LOWER("token")  != LOWER($2)
    GROUP BY "owner", "token"
    HAVING sum(liquidity) > 0;`,
    values: [block.blockNumber, WETH],
  });
  const pgSqlShutdown = client.end();

  const liquiditiesRows = liquidities.rows.map((r) => ({
    ...r,
    pool: getPoolAddressFromTokenAddress(r.token),
    liquidity: BigInt(r.liquidity),
  }));

  const pools: string[] = uniq(liquiditiesRows.map(({ pool }) => pool));

  const poolReserves = await multicall(
    provider,
    IXfaiPool__factory,
    pools.map((p) => ({
      arguments: [],
      contractAddress: p,
      function_name: "getStates",
    })),
    {
      allowFailure: false,
      callOverrides: {
        blockTag: block.blockNumber,
      },
    }
  );
  const poolSupplies = await multicall(
    provider,
    IXfaiPool__factory,
    pools.map((p) => ({
      arguments: [],
      contractAddress: p,
      function_name: "totalSupply",
    })),
    {
      allowFailure: false,
      callOverrides: {
        blockTag: block.blockNumber,
      },
    }
  );

  const poolRes = Object.fromEntries(
    Object.entries(poolReserves).map(([pool, [reserve, ethReserve]]) => [
      pool,
      {
        reserve,
        ethReserve,
      },
    ])
  );

  const result: OutputDataSchemaRow[] = liquiditiesRows.flatMap(
    ({
      owner,
      token,
      pool: poolAddress,
      liquidity,
      blockNumber: block_number,
      timestamp,
    }) => {
      const poolSupply = poolSupplies[poolAddress];
      const poolReserve = poolRes[poolAddress];
      const tokenBalance =
        (liquidity * poolReserve.reserve.toBigInt()) / poolSupply.toBigInt();
      const ethBalance =
        (liquidity * poolReserve.ethReserve.toBigInt()) / poolSupply.toBigInt();
      return [
        // Token reserve
        {
          block_number: Number(block.blockNumber),
          timestamp,
          user_address: owner,
          token_address: token,
          token_balance: tokenBalance,
          token_symbol: "",
          usd_price: 0,
        },
        // WETH Reserve
        {
          block_number: Number(block.blockNumber),
          timestamp,
          user_address: owner,
          token_address: WETH,
          token_balance: ethBalance,
          token_symbol: "WETH",
          usd_price: 0,
        },
      ];
    }
  );
  await Promise.all([pgSqlShutdown]);

  return result;
}

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
    const batchSize = 1000; // Size of batch to trigger writing to the file
    let i = 0;

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
      // const randomTime = Math.random() * 1000;
      // setTimeout(resolve, randomTime);
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
