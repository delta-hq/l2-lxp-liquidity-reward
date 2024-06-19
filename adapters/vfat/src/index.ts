import { promisify } from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import fs from 'fs';
import { write } from 'fast-csv';

import { BlockData, OutputSchemaRow } from './sdk/pancake/types';

import { UserVote, UserPosition } from './sdk/nile/types';

import {
  getTimestampAtBlock,
  getV3UserPositionsAtBlock,
  getSickles,
  getSickleOwners,
} from './sdk/pancake/lib';

import {
  getNileV3UserPositionsAtBlock,
  getV2UserPositionsAtBlock,
} from './sdk/nile/positions';

import { fetchUserVotes } from './sdk/nile/lensDetails';
import BigNumber from 'bignumber.js';

const pipeline = promisify(stream.pipeline);

const NILE_ADDRESS = '0xAAAac83751090C6ea42379626435f805DDF54DC8'.toLowerCase();

export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const result: OutputSchemaRow[] = [];

  // Get PancakeSwap positions
  const v3Positions = await getV3UserPositionsAtBlock(blockNumber);

  // Get Nile positions
  const nilePositions = await getUserLiquidityTVLByBlock({
    blockNumber,
    blockTimestamp,
  });

  // Combine positions from both sources
  const combinedPositions = [
    ...v3Positions.map((pos) => ({
      user_address: pos.user,
      token_address: pos.token0.address,
      token_balance: pos.token0.balance,
    })),
    ...v3Positions.map((pos) => ({
      user_address: pos.user,
      token_address: pos.token1.address,
      token_balance: pos.token1.balance,
    })),
    ...nilePositions,
  ];

  const balances: Record<string, Record<string, bigint>> = {};
  for (const position of combinedPositions) {
    balances[position.user_address] = balances[position.user_address] || {};
    if (position.token_balance > 0n)
      balances[position.user_address][position.token_address] =
        (balances?.[position.user_address]?.[position.token_address] ?? 0n) +
        position.token_balance;
  }

  // Get sickles and their owners
  const sickleAddresses = await getSickles(blockNumber);
  const sickleOwners = await getSickleOwners(
    sickleAddresses.map((s) => s.sickle)
  );

  // Remove all non-sickle addresses from balances
  const sickleAddressSet = new Set(
    sickleAddresses.map((s) => s.sickle.toLowerCase())
  );
  const sickleBalances: Record<string, Record<string, bigint>> = {};
  for (const [user, tokenBalances] of Object.entries(balances)) {
    if (sickleAddressSet.has(user.toLowerCase())) {
      sickleBalances[user] = tokenBalances;
    }
  }

  // Replace sickle addresses with their owners
  const updatedBalances: Record<string, Record<string, bigint>> = {};
  for (const [user, tokenBalances] of Object.entries(sickleBalances)) {
    const owner = (
      (sickleOwners as Record<string, string>)[user] || user
    ).toLowerCase(); // Replace sickle address with owner address
    if (!updatedBalances[owner]) {
      updatedBalances[owner] = {};
    }

    for (const [token, balance] of Object.entries(tokenBalances)) {
      if (!updatedBalances[owner][token]) {
        updatedBalances[owner][token] = 0n;
      }
      updatedBalances[owner][token] += balance;
    }
  }

  for (const [user, tokenBalances] of Object.entries(updatedBalances)) {
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
    getNileV3UserPositionsAtBlock(blockNumber),
  ]);

  const userAddresses = [...v2Positions, ...v3Positions]
    .map((pos) => pos.user)
    .reduce(
      (prev, curr) => (prev.includes(curr) ? prev : [...prev, curr]),
      [] as string[]
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
  userAddresses: string[]
): Promise<UserVote[]> => {
  const result: UserVote[] = [];
  const tokenBalanceMap = {} as {
    [userAddress: string]: BigNumber;
  };

  const batchSize = 300;
  let userVotesResult: any[] = [];
  for (let i = 0; i < userAddresses.length; i += batchSize) {
    const batch = userAddresses.slice(i, i + batchSize);
    userVotesResult = userVotesResult.concat(
      await Promise.all(
        batch.map((user) => fetchUserVotes(BigInt(blockNumber), user))
      )
    );
  }

  for (const userFecthedVotes of userVotesResult) {
    for (const userVote of userFecthedVotes) {
      const userAddress = userVote.result.userAddress.toLowerCase();
      tokenBalanceMap[userAddress] = BigNumber(
        tokenBalanceMap[userAddress] ?? 0
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

readBlocksFromCSV('hourly_blocks.csv')
  .then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        // Accumulate CSV rows for all blocks
        allCsvRows.push(...result);
      } catch (error) {
        console.error(`An error occurred for block ${block.blockNumber}:`, error);
      }
    }

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream('outputData.csv', { flags: 'w' });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on('finish', () => {
          console.log('CSV file has been written.');
          resolve;
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  })
  .catch((err) => {
    console.error('Error reading CSV file:', err);
  });
