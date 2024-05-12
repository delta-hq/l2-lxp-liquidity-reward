import { createObjectCsvWriter } from "csv-writer";
import { write } from "fast-csv";
import csv from "csv-parser";
import {
  client,
  PROTOCOL_DEPLOY_BLOCK,
  SNAPSHOT_PERIOD_BLOCKS,
  FIRST_TIME,
  POOL_TOKENS,
} from "./sdk/config";
import {
  OutputDataSchemaRow,
  BlockData,
  UserPositions,
  Transaction,
  CumulativePositions,
  Reserves,
  UserReserves,
  UserPosition,
} from "./sdk/types";
import { TRANSFERS_QUERY, SYNCS_QUERY } from "./sdk/queries";
import {
  getLatestBlockNumberAndTimestamp,
  getTimestampAtBlock,
  readLastProcessedBlock,
  saveLastProcessedBlock,
} from "./sdk/utils";
import fs from "fs";

// Processes a block range to calculate user positions for mints and burns
async function processBlockData(block: number): Promise<UserPosition[]> {
  // fetch lp transfers up to block
  const liquidityData = await fetchTransfers(block);

  const { userPositions, cumulativePositions } =
    processTransactions(liquidityData);

  // get reserves at block
  const reservesSnapshotAtBlock = await fetchReservesForPools(block);

  console.log("reservesSnapshotAtBlock");
  // calculate tokens based on reserves
  const userReserves = calculateUserReservePortion(
    userPositions,
    cumulativePositions,
    reservesSnapshotAtBlock
  );

  console.log("ok");

  const timestamp = await getTimestampAtBlock(block);

  // convert userReserves to userPositions
  return convertToUserPositions(userReserves, block, timestamp);
}

function convertToUserPositions(
  userData: UserReserves,
  block_number: number,
  timestamp: number
): UserPosition[] {
  console.log(`userData`, userData);

  const tempResults: Record<string, UserPosition> = {};

  Object.keys(userData).forEach((user) => {
    const contracts = userData[user];
    Object.keys(contracts).forEach((contractId) => {
      const details = contracts[contractId];

      // Process token0
      const key0 = `${user}-${details.token0}`;
      if (!tempResults[key0]) {
        tempResults[key0] = {
          block_number,
          timestamp,
          user,
          token: details.token0,
          balance: details.amount0,
        };
      } else {
        tempResults[key0].balance += details.amount0;
      }

      // Process token1
      const key1 = `${user}-${details.token1}`;
      if (!tempResults[key1]) {
        tempResults[key1] = {
          block_number,
          timestamp,
          user,
          token: details.token1,
          balance: details.amount1,
        };
      } else {
        tempResults[key1].balance += details.amount1;
      }
    });
  });

  // Convert the map to an array of UserPosition
  return Object.values(tempResults);
}
function calculateUserReservePortion(
  userPositions: UserPositions,
  totalSupply: CumulativePositions,
  reserves: Reserves
): UserReserves {
  const userReserves: UserReserves = {};

  Object.keys(userPositions).forEach((contractId) => {
    if (
      !totalSupply[contractId] ||
      !reserves[contractId] ||
      !POOL_TOKENS[contractId]
    ) {
      console.log(`Missing data for contract ID: ${contractId}`);
      return;
    }

    Object.keys(userPositions[contractId]).forEach((user) => {
      const userPosition = userPositions[contractId][user];
      const total = totalSupply[contractId];

      const share = userPosition / total;
      const reserve0 = reserves[contractId].reserve0;
      const reserve1 = reserves[contractId].reserve1;
      const token0 = POOL_TOKENS[contractId].token0;
      const token1 = POOL_TOKENS[contractId].token1;

      if (!userReserves[user]) {
        userReserves[user] = {};
      }

      userReserves[user][contractId] = {
        amount0: BigInt(Math.floor(share * reserve0)),
        amount1: BigInt(Math.floor(share * reserve1)),
        token0: token0,
        token1: token1,
      };
    });
  });

  return userReserves;
}

function processTransactions(transactions: Transaction[]): {
  userPositions: UserPositions;
  cumulativePositions: CumulativePositions;
} {
  const userPositions: UserPositions = {};
  const cumulativePositions: CumulativePositions = {};

  transactions.forEach((transaction) => {
    // Normalize addresses for case-insensitive comparison
    const fromAddress = transaction.from.toLowerCase();
    const toAddress = transaction.to.toLowerCase();
    const contractId = transaction.contractId_.toLowerCase();

    // Skip transactions where 'from' or 'to' match the contract ID, or both 'from' and 'to' are zero addresses
    if (
      fromAddress === contractId ||
      toAddress === contractId ||
      (fromAddress === "0x0000000000000000000000000000000000000000" &&
        toAddress === "0x0000000000000000000000000000000000000000")
    ) {
      return;
    }

    // Initialize cumulativePositions if not already set
    if (!cumulativePositions[contractId]) {
      cumulativePositions[contractId] = 0;
    }

    // Convert the transaction value from string to integer.
    let value = parseInt(transaction.value.toString());

    // Process transactions that increase liquidity (to address isn't zero)
    if (toAddress !== "0x0000000000000000000000000000000000000000") {
      if (!userPositions[contractId]) {
        userPositions[contractId] = {};
      }
      if (!userPositions[contractId][toAddress]) {
        userPositions[contractId][toAddress] = 0;
      }
      userPositions[contractId][toAddress] += value;
      cumulativePositions[contractId] += value;
    }

    // Process transactions that decrease liquidity (from address isn't zero)
    if (fromAddress !== "0x0000000000000000000000000000000000000000") {
      if (!userPositions[contractId]) {
        userPositions[contractId] = {};
      }
      if (!userPositions[contractId][fromAddress]) {
        userPositions[contractId][fromAddress] = 0;
      }
      userPositions[contractId][fromAddress] -= value;
      cumulativePositions[contractId] -= value;
    }
  });

  return { userPositions, cumulativePositions };
}

async function fetchTransfers(blockNumber: number) {
  const { data } = await client.query({
    query: TRANSFERS_QUERY,
    variables: { blockNumber },
    fetchPolicy: "no-cache",
  });
  return data.transfers;
}

async function fetchReservesForPools(blockNumber: number): Promise<Reserves> {
  const reserves: Reserves = {};

  await Promise.all(
    Object.keys(POOL_TOKENS).map(async (pool) => {
      const { data } = await client.query({
        query: SYNCS_QUERY,
        variables: { blockNumber, contractId: pool },
        fetchPolicy: "no-cache",
      });
      reserves[pool] = {
        reserve0: data.syncs[0].reserve0,
        reserve1: data.syncs[0].reserve1,
      };
    })
  );
  return reserves;
}

function convertToOutputDataSchema(
  userPositions: UserPosition[]
): OutputDataSchemaRow[] {
  return userPositions.map((userPosition) => {
    return {
      block_number: userPosition.block_number,
      timestamp: userPosition.timestamp,
      user_address: userPosition.user,
      token_address: userPosition.token,
      token_balance: BigInt(userPosition.balance), // Ensure balance is treated as bigint
      token_symbol: "", // You may want to fill this based on additional token info you might have
      usd_price: 0, // Adjust if you need to calculate this value or pull from another source
    };
  });
}

// Get block ranges for processing
async function getBlockRangesToFetch() {
  const startBlock = FIRST_TIME
    ? PROTOCOL_DEPLOY_BLOCK
    : readLastProcessedBlock();

  if (!startBlock) {
    console.error("Failed to read last processed block");
    return [];
  }

  const { blockNumber } = await getLatestBlockNumberAndTimestamp();

  const blocks = [];
  for (let i = startBlock; i <= blockNumber; i += SNAPSHOT_PERIOD_BLOCKS) {
    blocks.push(i);
  }
  return blocks;
}

// Saves processed data to a CSV file
async function saveToCSV(outputData: OutputDataSchemaRow[]) {
  const csvPath = "output.csv";
  const fileExists = fs.existsSync(csvPath);

  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "block_number", title: "Block Number" },
      { id: "timestamp", title: "Timestamp" },
      { id: "user_address", title: "User Address" },
      { id: "token_address", title: "Token Address" },
      { id: "token_balance", title: "Token Balance" },
      { id: "token_symbol", title: "Token Symbol" },
      { id: "usd_price", title: "USD Price" },
    ],
    append: fileExists,
  });

  await csvWriter.writeRecords(outputData);
  console.log("CSV file has been written successfully");
}

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const data: UserPosition[] = await processBlockData(blocks.blockNumber);
  return convertToOutputDataSchema(data);
};

async function main() {
  console.log(`Starting data fetching process mode: ${FIRST_TIME}`);
  const blocks = await getBlockRangesToFetch();

  let lastblock = 0;
  try {
    for (const block of blocks) {
      lastblock = block;
      const blockData = await getUserTVLByBlock({
        blockNumber: block,
        blockTimestamp: 0,
      });
      console.log("Processed block", block);
      await saveToCSV(blockData);
    }
  } catch (error: any) {
    console.error("Error processing block", lastblock, error.message);
  } finally {
    saveLastProcessedBlock(lastblock);
  }
}

// IMPORTANT: config::FIRST_TIME is set to true be default
// after inital fetch set it to false
// main().catch(console.error);

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
