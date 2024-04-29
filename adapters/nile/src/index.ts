import fs from "fs";
import { write } from "fast-csv";
import { BlockData, OutputSchemaRow, UserVote } from "./sdk/types";
import {
  getV2UserPositionsAtBlock,
  getV3UserPositionsAtBlock,
} from "./sdk/positions";
import { getTimestampAtBlock } from "./sdk/common";
import { fetchUserVotes } from "./sdk/lensDetails";
import BigNumber from "bignumber.js";
import csv from 'csv-parser';

const getData = async () => {
  const snapshotBlocks = [3753501];

  const csvRows: OutputSchemaRow[] = [];

  for (let block of snapshotBlocks) {
    const timestamp = await getTimestampAtBlock(block);
    csvRows.push(
      ...(await getUserTVLByBlock({
        blockNumber: block,
        blockTimestamp: timestamp,
      })),
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

  const combinedPositions = await getUserLiquidityTVLByBlock({
    blockNumber,
    blockTimestamp,
  });

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

export const getUserLiquidityTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const result: OutputSchemaRow[] = [];

  const [v2Positions, v3Positions] = await Promise.all([
    getV2UserPositionsAtBlock(blockNumber),
    getV3UserPositionsAtBlock(blockNumber),
  ]);

  const userAddresses = [...v2Positions, ...v3Positions]
    .map((pos) => pos.user)
    .reduce(
      (prev, curr) => (prev.includes(curr) ? prev : [...prev, curr]),
      [] as string[],
    );

  const userVotes = await getUserVotesTVLByBlock(blockNumber, userAddresses);

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

  for (const userVote of userVotes) {
    result.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: userVote.user,
      token_address: NILE_ADDRESS,
      token_balance: userVote.balance,
    });
  }

  return result;
};

export const getUserVotesTVLByBlock = async (
  blockNumber: number,
  userAddresses: string[],
): Promise<UserVote[]> => {
  const result: UserVote[] = [];
  const tokenBalanceMap = {} as {
    [userAddress: string]: BigNumber;
  };

  const userVotesFetch = [];

  for (const user of userAddresses) {
    userVotesFetch.push(fetchUserVotes(BigInt(blockNumber), user));
  }

  const userVotesResult = await Promise.all(userVotesFetch);

  for (const userFecthedVotes of userVotesResult) {
    for (const userVote of userFecthedVotes) {
      const userAddress = userVote.result.userAddress.toLowerCase();
      tokenBalanceMap[userAddress] = BigNumber(
        tokenBalanceMap[userAddress] ?? 0,
      ).plus(userVote.result.amount.toString());
    }
  }

  Object.entries(tokenBalanceMap).forEach(([userAddress, balance]) => {
    if (balance.dp(0).lte(0)) {
      return;
    }
    result.push({
      user: userAddress,
      balance: BigInt(balance.dp(0).toNumber()),
    });
  });
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
