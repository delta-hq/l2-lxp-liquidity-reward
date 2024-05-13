import { getEvents } from "./sdk/subgraphDetails";
import csv from 'csv-parser';
import fs from "fs";
import { write } from "fast-csv";


export const BATCH_SIZE = 1000;
export const ETH_VAULT_ADDRESS = "0xa5cb30e5d30a9843b6481ffd8d8d35dded3a3251";
export const ETH_VAULT_DEPLOY_BLOCK = 240;
export const USDC_VAULT_ADDRESS = "0x9d90cfa17f3afcee2505b3e9d75113e6f5c9e843";
export const USDC_VAULT_DEPLOY_BLOCK = 206280;
export const VAULT_TO_TOKEN: Record<string, string> = {
  [ETH_VAULT_ADDRESS]: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  [USDC_VAULT_ADDRESS]: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff"
};
export const ADDRESS_TO_TOKEN_SYMBOL: Record<string, string> = {
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH",
  "0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "USDC"
};

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const getAllEvents = async (tillBlockNumber: number) => {
  let offset = 0;
  let depositFulfilleds: any[] = [];
  let depositRequesteds: any[] = [];
  let withdrawalFulfilleds: any[] = [];
  while (true) {
    const events = await getEvents(tillBlockNumber, offset, BATCH_SIZE);
    depositFulfilleds.push(...events.depositFulfilleds);
    depositRequesteds.push(...events.depositRequesteds);
    withdrawalFulfilleds.push(...events.withdrawalFulfilleds);
    if (events.depositFulfilleds.length === 0
      && events.depositRequesteds.length === 0
      && events.withdrawalFulfilleds.length === 0) {
      break;
    }
    offset += BATCH_SIZE;
  }
  return { depositFulfilleds, depositRequesteds, withdrawalFulfilleds };
}

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  const events = await getAllEvents(blockNumber);
  console.log("DepositFulfilleds: ", events.depositFulfilleds.length);
  console.log("DepositRequesteds: ", events.depositRequesteds.length);
  console.log("WithdrawalFulfilleds: ", events.withdrawalFulfilleds.length);
  
  let userTVL = {} as {
    [userAddress: string]: { [tokenAddress: string]: bigint };
  };
  let fulfilledDepositIds = new Set();
  for (let event of events.depositFulfilleds) {
    fulfilledDepositIds.add(event.depositId);
  }
  for (let event of events.depositRequesteds) {
    if (!fulfilledDepositIds.has(event.depositId)) {
      continue;
    }
    const userAddress = event.sender.toLowerCase();
    const tokenAddress = VAULT_TO_TOKEN[event.contractId_];
    const tokenBalance = BigInt(event.amountDepositToken);
    userTVL[userAddress] = userTVL[userAddress] ?? {};
    userTVL[userAddress][tokenAddress] = (
      userTVL[userAddress][tokenAddress] ?? BigInt(0)
    ) + tokenBalance;
  }
  for (let event of events.withdrawalFulfilleds) {
    const userAddress = event.recipient.toLowerCase();
    const tokenAddress = VAULT_TO_TOKEN[event.contractId_];
    const tokenBalance = BigInt(event.amountDepositToken);
    userTVL[userAddress] = userTVL[userAddress] ?? {};
    userTVL[userAddress][tokenAddress] = (
      userTVL[userAddress][tokenAddress] ?? BigInt(0)
    ) - tokenBalance;
  }
  console.log("UserTVL: ", Object.keys(userTVL).length);

  // block_number: number;  //block_number which was given as input
  // timestamp: number;     // block timestamp which was given an input, epoch format
  // user_address: string;   // wallet address, all lowercase
  // token_address: string;  // token address all lowercase
  // token_balance: bigint;  // token balance, raw amount. Please dont divide by decimals
  // token_symbol: string; //token symbol should be empty string if it is not available
  // usd_price: number; //assign 0 if not available
  const csvRows: OutputDataSchemaRow[] = [];
  for (let [userAddress, balances] of Object.entries(userTVL)) {
    for (let [tokenAddress, tokenBalance] of Object.entries(balances)) {
      if (tokenBalance > BigInt(0)) {
        csvRows.push({
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: userAddress,
          token_address: tokenAddress,
          token_balance: tokenBalance,
          token_symbol: ADDRESS_TO_TOKEN_SYMBOL[tokenAddress], //token symbol should be empty string if it is not available
          usd_price: 0 //assign 0 if not available
        });
      }
    }
  }
  // console.log("csvRows", csvRows);
  
  return csvRows
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
