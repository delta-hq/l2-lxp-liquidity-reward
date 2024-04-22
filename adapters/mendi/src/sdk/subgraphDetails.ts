import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { CHAINS, PROTOCOLS, RPC_URLS, SUBGRAPH_URLS } from "./config";
import {
  getBorrowBalanceStoredByAccounts,
  getMarketInfos,
} from "./marketDetails";

export interface MarketActivity {
  id: string;
  amount: bigint;
  owner: string;
  market: string;
  blockNumber: number;
}

export const getActivitiesForAddressByPoolAtBlock = async (
  blockNumber: number,
  address: string,
  poolId: string,
  chainId: CHAINS,
  protocol: PROTOCOLS
): Promise<{ tokens: MarketActivity[]; accountBorrows: MarketActivity[] }> => {
  const marketInfos = await getMarketInfos(
    "0x1b4d3b0421ddc1eb216d230bc01527422fb93103",
    BigInt(blockNumber)
  );
  address = address?.toLowerCase();

  let bnWhereQuery = blockNumber ? `block_number_lte: ${blockNumber} \n` : "";
  let transferWhereQuery = address
    ? orWhere(`to: "${address}"`, `from: "${address}"`)
    : "";
  let borrowerWhereQuery = address ? `borrower: "${address}" \n` : "";

  let skip = 0;
  let fetchNext = true;

  const pageSize = 1000;
  const url = SUBGRAPH_URLS[chainId][protocol].url;

  let tokens: MarketActivity[] = [];
  let accountBorrows: MarketActivity[] = [];

  while (fetchNext) {
    let query = `
    {
        transfers(
            where: { ${andWhere(bnWhereQuery, transferWhereQuery)} } 
            orderBy: id, first: ${pageSize}, skip: ${skip}) 
        {
          id
          from
          to
          amount
          block_number
          contractId_
        }
        borrows(
          where: { ${andWhere(bnWhereQuery, borrowerWhereQuery)} } 
          orderBy: id, first: ${pageSize}, skip: ${skip}) 
        {
          id
          borrower
          accountBorrows
          block_number
          contractId_
        }
        repayBorrows(
          where: { ${andWhere(bnWhereQuery, borrowerWhereQuery)} }  
          orderBy: id, first: ${pageSize}, skip: ${skip}) 
        {
          id
          borrower
          accountBorrows
          block_number
          contractId_
        }
      }
    `;
    console.log(`Fetching ${skip} - ${skip + pageSize} / unknown`);

    let response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();

    // tokens
    const mints = data.data.transfers
      .filter((m: any) => m.to != m.contractId_)
      .map((m: any) => ({
        id: m.id,
        amount: BigInt(m.amount),
        owner: m.to,
        market: m.contractId_,
        blockNumber: m.block_number,
      }));

    const redeems = data.data.transfers
      .filter((m: any) => m.from != m.contractId_)
      .map((m: any) => ({
        id: m.id,
        amount: -BigInt(m.amount),
        owner: m.from,
        market: m.contractId_,
        blockNumber: m.block_number,
      }));

    // borrows
    const borrows = data.data.borrows.map((m: any) => ({
      id: m.id,
      amount: -BigInt(m.accountBorrows),
      owner: m.borrower,
      market: m.contractId_,
      blockNumber: m.block_number,
    }));
    const repayBorrows = data.data.repayBorrows.map((m: any) => ({
      id: m.id,
      amount: -BigInt(m.accountBorrows),
      owner: m.borrower,
      market: m.contractId_,
      blockNumber: m.block_number,
    }));

    tokens.push(...mints, ...redeems);
    accountBorrows.push(...borrows, ...repayBorrows);

    if (
      mints.length == 0 &&
      redeems.length == 0 &&
      borrows.length == 0 &&
      repayBorrows.length == 0
    ) {
      fetchNext = false;
    } else {
      skip += pageSize;
    }
  }

  tokens = tokens
    .map((t: any) => {
      const marketInfo = marketInfos.get(t.market.toLowerCase());
      if (!marketInfo) {
        return undefined;
      }

      return {
        ...t,
        amount: t.amount * marketInfo.exchangeRateStored,
      };
    })
    .filter((x) => x !== undefined);

  accountBorrows = await normalizeAccountBorrows(blockNumber, accountBorrows);
  accountBorrows.forEach((t: any) => (t.amount = t.amount * BigInt(1e18)));

  return { tokens, accountBorrows };
};

export const normalizeAccountBorrows = async (
  blockNumber: number,
  accountBorrows: MarketActivity[]
): Promise<MarketActivity[]> => {
  const result: MarketActivity[] = [];

  accountBorrows.sort((a, b) => b.blockNumber - a.blockNumber);

  for (let i = 0; i < accountBorrows.length; i++) {
    var marketActivity = accountBorrows[i];

    var doesExist =
      result.findIndex(
        (x: MarketActivity) =>
          x.owner == marketActivity.owner && x.market == marketActivity.market
      ) > -1;
    if (doesExist) continue;

    result.push(marketActivity);
  }

  const chuckCount = 2000;
  for (let i = 0; i < result.length; i += chuckCount) {
    var end = Math.min(result.length, i + chuckCount);

    var currentBorrows = await getBorrowBalanceStoredByAccounts(
      result.slice(i, end),
      BigInt(blockNumber)
    );

    for (let j = 0; j < currentBorrows.length; j++) {
      result[i + j].amount = -BigInt(currentBorrows[j]);
    }
  }

  return result;
};

export const getLPValueByUserAndPoolFromActivities = (
  tokens: MarketActivity[],
  accountBorrows: MarketActivity[]
): Map<string, Map<string, bigint>> => {
  // owner => market => amount
  let result = new Map<string, Map<string, bigint>>();

  // get latest account borrows
  // sort descending to block number
  accountBorrows.sort((a, b) => b.blockNumber - a.blockNumber);

  for (let i = 0; i < accountBorrows.length; i++) {
    let marketActivity = accountBorrows[i];
    let market = marketActivity.market;
    let owner = marketActivity.owner;
    let amount = marketActivity.amount;

    let userActivities = result.get(owner);
    if (userActivities === undefined) {
      userActivities = new Map<string, bigint>();
      result.set(owner, userActivities);
    }

    let poolActivities = userActivities.get(market);
    if (poolActivities === undefined) {
      userActivities.set(market, amount);
    }
  }

  // add token activities
  for (let i = 0; i < tokens.length; i++) {
    let marketActivity = tokens[i];

    let market = marketActivity.market;
    let owner = marketActivity.owner;
    let amount = marketActivity.amount;

    let userActivities = result.get(owner);
    if (userActivities === undefined) {
      userActivities = new Map<string, bigint>();
      result.set(owner, userActivities);
    }

    let poolActivities = userActivities.get(market);
    if (poolActivities === undefined) {
      poolActivities = BigInt(0);
    }

    poolActivities = poolActivities + amount;
    userActivities.set(market, poolActivities);
  }

  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const publicClient = createPublicClient({
    chain: extractChain({ chains: [linea], id: CHAINS.LINEA }),
    transport: http(RPC_URLS[CHAINS.LINEA]),
  });

  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};

const andWhere = (...queries: string[]) => {
  return `and: [
    ${queries.map((q) => `{ ${q} }`).join("\n")}
  ]`;
};
const orWhere = (...queries: string[]) => {
  return `or: [
  ${queries.map((q) => `{ ${q} }`).join("\n")}
]`;
};
