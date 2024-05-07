import { Account, createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { CHAINS, PROTOCOLS, RPC_URLS, SUBGRAPH_URLS } from "./config";
import { getMarketInfos } from "./marketDetails";

export interface AccountState {
  id: string;
  account: string;
  token: string;
  lentAmount: bigint;
  borrowAmount: bigint;
}

export const getAccountStatesForAddressByPoolAtBlock = async (
  blockNumber: number,
  address: string,
  poolId: string,
  chainId: CHAINS,
  protocol: PROTOCOLS
): Promise<AccountState[]> => {
  const marketInfos = await getMarketInfos(
    "0x1b4d3b0421ddc1eb216d230bc01527422fb93103",
    BigInt(blockNumber)
  );
  address = address?.toLowerCase();

  let accountWhereQuery = address ? `account: "${address}" \n` : "";
  let amountWhereQuery = orWhere("lentAmount_not: 0", "borrowAmount_not: 0");

  let skip = 0;
  let fetchNext = true;

  const pageSize = 1000;
  const url = SUBGRAPH_URLS[chainId][protocol].url;

  let states: AccountState[] = [];

  while (fetchNext) {
    let query = `
    query TVLQuery {
      accountStates(
        block: {number: ${blockNumber}}
        where: {
          ${andWhere(accountWhereQuery, amountWhereQuery)}
        }
        orderBy: id
        first: ${pageSize}
        skip: ${skip}
      ) {
        id
        account
        token {
          id
        }
        lentAmount
        borrowAmount
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

    states.push(
      ...data.data.accountStates.map((m: any) => ({
        id: m.id,
        account: m.account,
        token: m.token.id,
        lentAmount: BigInt(m.lentAmount),
        borrowAmount: BigInt(m.borrowAmount),
      }))
    );

    if (data.data.accountStates.length == 0) {
      fetchNext = false;
    } else {
      skip += pageSize;
    }
  }

  states = states
    .map((state: AccountState) => {
      const marketInfo = marketInfos.find(
        (mi) => mi.underlyingAddress == state.token.toLowerCase()
      );
      if (!marketInfo) {
        return undefined;
      }

      return {
        ...state,
        lentAmount:
          (state.lentAmount * marketInfo.exchangeRateStored) / BigInt(1e18),
      };
    })
    .filter((x) => x !== undefined) as AccountState[];

  return states;
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
