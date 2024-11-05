import { agETHBalancerOf } from "./fetcher";
import { subgraphFetchAllById } from "./query";
import { gql } from "graphql-request";
import { YAY_START_BLOCK } from "./utils";

export const YAY_LP_ADDRESS = "0x0341d2c2CE65B62aF8887E905245B8CfEA2a3b97";

export async function getYayAgEthHodlers(block: number) {
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

interface Share {
  id: string;
  balance: string;
}

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
