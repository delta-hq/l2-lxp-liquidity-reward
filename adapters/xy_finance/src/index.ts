import { getEvents } from "./sdk/subgraphDetails";

export const BATCH_SIZE = 1000;
export const ETH_VAULT_ADDRESS = "0xa5cb30e5d30a9843b6481ffd8d8d35dded3a3251";
export const ETH_VAULT_DEPLOY_BLOCK = 240;
export const USDC_VAULT_ADDRESS = "0x9d90cfa17f3afcee2505b3e9d75113e6f5c9e843";
export const USDC_VAULT_DEPLOY_BLOCK = 206280;
export const VAULT_TO_TOKEN: Record<string, string> = {
  [ETH_VAULT_ADDRESS]: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  [USDC_VAULT_ADDRESS]: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"
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
    const tokenBalance = event.amountDepositToken;
    userTVL[userAddress] = userTVL[userAddress] ?? {};
    userTVL[userAddress][tokenAddress] = (
      userTVL[userAddress][tokenAddress] ?? BigInt(0)
    ) + tokenBalance;
  }
  for (let event of events.withdrawalFulfilleds) {
    const userAddress = event.recipient.toLowerCase();
    const tokenAddress = VAULT_TO_TOKEN[event.contractId_];
    const tokenBalance = event.amountDepositToken;
    userTVL[userAddress] = userTVL[userAddress] ?? {};
    userTVL[userAddress][tokenAddress] = (
      userTVL[userAddress][tokenAddress] ?? BigInt(0)
    ) - tokenBalance;
  }
  console.log("UserTVL: ", Object.keys(userTVL).length);

  const csvRows: OutputDataSchemaRow[] = [];
  for (let [userAddress, balances] of Object.entries(userTVL)) {
    for (let [tokenAddress, tokenBalance] of Object.entries(balances)) {
      csvRows.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: userAddress,
        token_address: tokenAddress,
        token_balance: tokenBalance,
        token_symbol: "", //token symbol should be empty string if it is not available
        usd_price: 0 //assign 0 if not available
      });
    }
  }
  console.log("csvRows", csvRows);
  
  return csvRows
};

// getUserTVLByBlock({ blockNumber: 3059710, blockTimestamp: 1711096813 })
getUserTVLByBlock({ blockNumber: 50000, blockTimestamp: 1690265613 })
