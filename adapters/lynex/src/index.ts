import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
import {
  getGauges,
  getTimestampAtBlock,
  getUserAddresses,
} from "./sdk/subgraphDetails";
import { LYNX_ADDRESS, fetchPools, fetchVeLynx } from "./sdk/lensDetails";
import BigNumber from "bignumber.js";
import { BlockData, OutputSchemaRow } from "./sdk/types";
import {
  getV2UserPositionsAtBlock,
  getV3UserPositionsAtBlock,
} from "./sdk/pools";

const getData = async () => {
  const snapshotBlocks = [4328548];

  const csvRows: OutputSchemaRow[] = [];

  for (let block of snapshotBlocks) {
    const timestamp = await getTimestampAtBlock(block);
    csvRows.push(
      ...(await getUserTVLByBlock({
        blockNumber: block,
        blockTimestamp: timestamp,
      }))
    );
  }

  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });
};

export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const result: OutputSchemaRow[] = [];

  const [stakedTvl, liquidityTvl] = await Promise.all([
    getUserStakedTVLByBlock({ blockNumber, blockTimestamp }),
    getUserLiquidityTVLByBlock({ blockNumber, blockTimestamp }),
  ]);

  // combine staked & unstaked
  const combinedPositions = [...stakedTvl, ...liquidityTvl];
  const balances: Record<string, Record<string, bigint>> = {};
  for (const position of combinedPositions) {
    balances[position.user_address] = balances[position.user_address] || {};

    if (position.token_balance > 0n)
      balances[position.user_address][position.token_address] =
        (balances?.[position.user_address]?.[position.token_address] ?? 0n) +
        position.token_balance;
  }

  for (const [user, tokenBalances] of Object.entries(balances)) {
    for (const [token, balance] of Object.entries(tokenBalances)) {
      result.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: user,
        token_address: token,
        token_balance: balance,
      });
    }
  }

  return result;
};

export const getUserStakedTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const result: OutputSchemaRow[] = [];
  const [userAddresses, allGauges] = await Promise.all([
    getUserAddresses(blockNumber),
    getGauges(blockNumber),
  ]);
  console.log(`Block: ${blockNumber}`);
  console.log("UserAddresses: ", userAddresses.length);
  console.log("Gauges: ", allGauges.length);

  const pools = await fetchPools(BigInt(blockNumber), allGauges);

  const tokenBalanceMap = {} as {
    [userAddress: string]: { [tokenAddress: string]: BigNumber };
  };

  let userVotesResult = await fetchVeLynx(BigInt(blockNumber));

  for (const user of userAddresses) {
    for (const userPool of user.liquidityPositions) {
      const currentPool = pools[userPool.gauge.pool.toLowerCase()]
        ? pools[userPool.gauge.pool.toLowerCase()][0]
        : undefined;
      if (currentPool) {
        const user_address = user.id.toLowerCase();
        const totalLPBalance = BigInt(userPool.amount);
      const total0 =
          (totalLPBalance * BigInt(currentPool.reserve0)) /
          BigInt(currentPool.total_supply);
      const total1 =
          (totalLPBalance * BigInt(currentPool.reserve1)) /
          BigInt(currentPool.total_supply);
        const token0Address = currentPool.token0.toLowerCase();
        const token1Address = currentPool.token1.toLowerCase();

      // Aggregate tokens
      tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
      tokenBalanceMap[user_address][token0Address] = BigNumber(
        tokenBalanceMap[user_address][token0Address] ?? 0
      ).plus(total0.toString());
      tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
      tokenBalanceMap[user_address][token1Address] = BigNumber(
        tokenBalanceMap[user_address][token1Address] ?? 0
      ).plus(total1.toString());
      }
    }
  }

  for (const userVote of userVotesResult) {
    if (!userVote.result?.userAddress) continue;
      const user_address = userVote.result.userAddress.toLowerCase();
      const token0Address = LYNX_ADDRESS.toLowerCase();
      tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
      tokenBalanceMap[user_address][token0Address] = BigNumber(
        tokenBalanceMap[user_address][token0Address] ?? 0
    ).plus(userVote.result.amount?.toString() ?? "0");
  }

  Object.entries(tokenBalanceMap).forEach(([user_address, balances]) => {
    Object.entries(balances).forEach(([token_address, token_balance]) => {
      if (token_balance.dp(0).lte(0)) {
        return;
      }
      result.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address,
        token_address,
        token_balance: BigInt(token_balance.dp(0).toNumber()),
      });
    });
  });
  return result;
};

export const getUserLiquidityTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const result: OutputSchemaRow[] = [];

  const [v2Positions, v3Positions] = await Promise.all([
    getV2UserPositionsAtBlock(blockNumber),
    getV3UserPositionsAtBlock(blockNumber),
  ]);

  // combine v2 & v3
  const combinedPositions = [...v2Positions, ...v3Positions];
  const balances: Record<string, Record<string, bigint>> = {};
  for (const position of combinedPositions) {
    balances[position.user] = balances[position.user] || {};

    if (position.token0.balance > 0n)
      balances[position.user][position.token0.address] =
        (balances?.[position.user]?.[position.token0.address] ?? 0n) +
        position.token0.balance;

    if (position.token1.balance > 0n)
      balances[position.user][position.token1.address] =
        (balances?.[position.user]?.[position.token1.address] ?? 0n) +
        position.token1.balance;
  }

  for (const [user, tokenBalances] of Object.entries(balances)) {
    for (const [token, balance] of Object.entries(tokenBalances)) {
      result.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: user,
        token_address: token,
        token_balance: balance,
      });
    }
  }

  return result;
};

// getData().then(() => {
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

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
  console.log(blocks);
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

  for (let block of blocks) {
    try {
      if (block.blockNumber <= 12028521) {
        block.blockNumber = 12030222
        block.blockTimestamp = 1731545998
      }
      const result = await getUserTVLByBlock(block);
      for (let i = 0; i < result.length; i++) {
        allCsvRows.push(result[i]);
      }
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
