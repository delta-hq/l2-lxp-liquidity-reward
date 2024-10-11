import { request } from "graphql-request";
import { gql } from "graphql-request";
import { agETHBalancerOf } from "./fetcher";

export const YAY_START_BLOCK = 20833064;

export const YAY_LP_ADDRESS = "0x0341d2c2CE65B62aF8887E905245B8CfEA2a3b97";

const MULTICALL_BATCH_SIZE = 1000;
interface IDwise {
  id: string;
}

export async function subgraphFetchAllById<T extends IDwise>(
  endpoint: string,
  query: string,
  collection: string,
  variables: Record<string, unknown>
): Promise<T[]> {
  const data: T[] = [];
  let lastId = "0x0000000000000000000000000000000000000000";
  while (true) {
    const resp: { [collection: string]: T[] } = await request(endpoint, query, {
      ...variables,
      lastId
    });

    const batch: T[] = resp[collection];
    if (batch.length == 0) {
      break;
    }

    const last = batch[batch.length - 1];
    lastId = last.id;

    data.push(...batch);

    if (batch.length < MULTICALL_BATCH_SIZE) {
      break;
    }
  }
  return data;
}

export type UserBalanceSubgraphEntry = {
  id: string;
  balance: string;
};

const YAYSUBGRAPH =
  "https://api.studio.thegraph.com/query/88724/yayagethtoken/version/latest";

const HOLDERS_Q = {
  query: gql`
    query getUserBalancesByDays($lastId: ID!, $block: Int) {
      userBalances(
        first: 1000
        where: { id_gt: $lastId }
        block: { number: $block }
        orderBy: id
      ) {
        balance
        id
      }
    }
  `,
  collection: "userBalances"
};

interface Share {
  id: string;
  balance: string;
}

export async function getAllAgEthHodlers(block: number) {
  if (block < YAY_START_BLOCK) {
    return [];
  }
  const shares = await subgraphFetchAllById<Share>(
    YAYSUBGRAPH,
    HOLDERS_Q.query,
    HOLDERS_Q.collection,
    { block: block }
  );

  const all = await agETHBalancerOf(block, YAY_LP_ADDRESS);

  let totalRsEthSaveToCSV = shares.reduce(
    (acc, s) => BigInt(acc) + BigInt(s.balance),
    0n
  );

  const diff = Number(BigInt(all) - totalRsEthSaveToCSV);
  if (Math.abs(diff) > 1000) {
    throw new Error(`To much diff ${diff}`);
  }
  return shares;
}
