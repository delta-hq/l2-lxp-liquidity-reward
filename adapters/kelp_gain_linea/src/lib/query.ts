import { request } from "graphql-request";
import { gql } from "graphql-request";
import { fetchAllPendleShare } from "./pendle";
import { fetchAllBalancerShare } from "./balancer";

const MULTICALL_BATCH_SIZE = 1000;

export const agETHSubgraph =
  "https://api.studio.thegraph.com/query/70817/ageth-lp/version/latest";
interface IDwise {
  id: string;
}

async function subgraphFetchAllById<T extends IDwise>(
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

interface GraphQLQuery {
  query: string;
  collection: string;
}

export type UserBalanceSubgraphEntry = {
  id: string;
  balance: string;
};

export const USER_BALANCES_QUERY: GraphQLQuery = {
  query: gql`
    query PositionsQuery($block: Int, $lastId: ID!) {
      userBalances(
        where: { balance_gt: "0", id_gt: $lastId }
        block: { number: $block }
        orderBy: id
        orderDirection: asc
        first: 1000
      ) {
        id
        balance
      }
    }
  `,
  collection: "userBalances"
};

export async function getAllAgEthHodlers(blockNumber: number) {
  const positions = await subgraphFetchAllById<UserBalanceSubgraphEntry>(
    agETHSubgraph,
    USER_BALANCES_QUERY.query,
    USER_BALANCES_QUERY.collection,
    { block: blockNumber, lastId: "0x0000000000000000000000000000000000000000" }
  );

  const pendleShares = await fetchAllPendleShare(blockNumber);
  const balancerShares = await fetchAllBalancerShare(blockNumber);

  positions.push(
    ...pendleShares.map((e) => {
      return {
        id: e.user,
        balance: e.share
      };
    })
  );

  positions.push(
    ...balancerShares.map((e) => {
      return {
        id: e.userAddress.id,
        balance: e.balance,
      };
    })
  )

  const balanceMap = new Map<string, bigint>();
  for (const balance of [...positions]) {
    balanceMap.set(
      balance.id,
      (balanceMap.get(balance.id) || 0n) + BigInt(balance.balance)
    );
  }

  const balances = Array.from(balanceMap, ([id, balance]) => ({
    id,
    balance: balance.toString()
  }));

  return balances;
}
