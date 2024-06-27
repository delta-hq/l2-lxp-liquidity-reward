import { request } from "graphql-request";
import { gql } from "graphql-request";

const MULTICALL_BATCH_SIZE = 1000;

const LINEA_WRSETH_SUBGRAPH =
  "https://api.thegraph.com/subgraphs/id/QmcxNC7ty8ZW6UTfjMQrmtfJLquzg1J7VhjJDYBeBMsVn5";
export const LINEA_WRSETH_ADDR = "0xD2671165570f41BBB3B0097893300b6EB6101E6C";
export const LINEA_WRSETH = "wrsETH";
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

export async function getAllRsEthHodlers(blockNumber: number) {
  const positions = await subgraphFetchAllById<UserBalanceSubgraphEntry>(
    LINEA_WRSETH_SUBGRAPH,
    USER_BALANCES_QUERY.query,
    USER_BALANCES_QUERY.collection,
    { block: blockNumber, lastId: "0x0000000000000000000000000000000000000000" }
  );
  return positions;
}
