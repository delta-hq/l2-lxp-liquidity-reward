import { createObjectCsvWriter } from "csv-writer";
import {
  client,
  PROTOCOL_DEPLOY_BLOCK,
  SNAPSHOT_PERIOD_BLOCKS,
  FIRST_TIME,
} from "./sdk/config";
import { OutputDataSchemaRow, BlockData, UserPosition } from "./sdk/types";
import { LIQUIDITY_QUERY, TOKEN_TRANSFERS_QUERY } from "./sdk/queries";
import {
  getLatestBlockNumberAndTimestamp,
  getTimestampAtBlock,
  readLastProcessedBlock,
  saveLastProcessedBlock,
} from "./sdk/utils";
import fs from "fs";

// Helper function to create a unique key
function createKey(user: string, tokenAddress: string, block: number): string {
  return `${user}-${tokenAddress}-${block}`;
}

// Processes a block range to calculate user positions for mints and burns
async function processBlockData(
  block: number
): Promise<[UserPosition[], UserPosition[]]> {
  const mintsDict: UserPosition[] = [];
  const burnsDict: UserPosition[] = [];

  const liquidityData = await fetchTransfersForMintsAndBurnsTillBlock(block);
  if (!liquidityData) {
    console.error(`Failed to fetch liquidity data for block ${block}`);
    return [[], []]; // Return empty arrays if data is not available
  }
  const blockTimestamp = await getTimestampAtBlock(block);
  await processTransfers(
    liquidityData.mints,
    block,
    blockTimestamp,
    mintsDict,
    "mint"
  );
  await processTransfers(
    liquidityData.burns,
    block,
    blockTimestamp,
    burnsDict,
    "burn"
  );

  return [mintsDict, burnsDict];
}

// Fetches sender information from a transaction
async function fetchSenderFromTransaction(tx: string) {
  const { data } = await client.query({
    query: TOKEN_TRANSFERS_QUERY,
    variables: { tx },
    fetchPolicy: "no-cache",
  });
  return {
    user: data.transfer1S[0].from,
    token0: data.transfer1S[0].contractId_,
    token1: data.transfer1S[1].contractId_,
  };
}

// General function to process either mints or burns
async function processTransfers(
  transfers: any[],
  block: number,
  blockTimestamp: number,
  dictionary: UserPosition[],
  type: "mint" | "burn"
) {
  for (const transfer of transfers) {
    const txId = transfer.transactionHash_;
    const txInfo = await fetchSenderFromTransaction(txId);
    if (!txInfo) {
      console.error(`Failed to fetch sender for transaction ${txId}`);
      continue;
    }

    let user;
    if (type === "mint") {
      user = txInfo.user;
    } else {
      user = transfer.to;
    }

    dictionary.push({
      block_number: block,
      timestamp: blockTimestamp,
      user: user,
      token: txInfo.token0,
      balance: transfer.amount0,
    });

    dictionary.push({
      block_number: block,
      timestamp: blockTimestamp,
      user: user,
      token: txInfo.token1,
      balance: transfer.amount1,
    });
  }
}

// Fetches transactions related to liquidity events
async function fetchTransfersForMintsAndBurnsTillBlock(blockNumber: number) {
  const { data } = await client.query({
    query: LIQUIDITY_QUERY,
    variables: { blockNumber },
    fetchPolicy: "no-cache",
  });
  return data;
}

function calculateUserPositions(
  deposits: UserPosition[],
  withdrawals: UserPosition[]
): UserPosition[] {
  const userPositionsMap: Map<string, UserPosition> = new Map();

  // Helper function to process both deposits and withdrawals
  const processPosition = (position: UserPosition, isDeposit: boolean) => {
    const key = createKey(position.user, position.token, position.block_number);
    const amountChange =
      BigInt(position.balance) * (isDeposit ? BigInt(1) : BigInt(-1));

    const existing = userPositionsMap.get(key);
    if (existing) {
      existing.balance += amountChange;
    } else {
      userPositionsMap.set(key, {
        block_number: position.block_number,
        timestamp: position.timestamp,
        user: position.user,
        token: position.token,
        balance: amountChange,
      });
    }
  };

  // Process each deposit and withdrawal
  deposits.forEach((deposit) => processPosition(deposit, true));
  withdrawals.forEach((withdrawal) => processPosition(withdrawal, false));

  return Array.from(userPositionsMap.values());
}

function convertToOutputDataSchema(
  userPositions: UserPosition[]
): OutputDataSchemaRow[] {
  return userPositions.flatMap((userPosition) => [
    {
      block_number: userPosition.block_number,
      timestamp: userPosition.timestamp,
      user_address: userPosition.user,
      token_address: userPosition.token,
      token_balance: userPosition.balance, // Keep as bigint
      token_symbol: "", // Adjust accordingly if you have the data
      usd_price: 0, // Adjust if you need to calculate this value
    },
  ]);
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

  console.log("Fetching blocks from", startBlock, "to", blockNumber);

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
  const [deposits, withdrawals] = await processBlockData(blocks.blockNumber);
  const userPositions = calculateUserPositions(deposits, withdrawals);
  return convertToOutputDataSchema(userPositions);
};
async function main() {
  console.log(`Starting data fetching process mode: ${FIRST_TIME}`);
  const blocks = await getBlockRangesToFetch();

  const userData: OutputDataSchemaRow[] = [];

  let lastblock = 0;
  try {
    for (const block of blocks) {
      const blockData = await getUserTVLByBlock({
        blockNumber: block,
        blockTimestamp: 0,
      });
      userData.push(...blockData);
      console.log("Processed block", block);
      lastblock = block;
    }
  } catch (error: any) {
    console.error("Error processing block", lastblock, error.message);
  } finally {
    saveLastProcessedBlock(lastblock);
  }

  await saveToCSV(userData);
}

// IMPORTANT: config::FIRST_TIME is set to true be default
// after inital fetch set it to false
main().catch(console.error);
