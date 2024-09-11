import { gql } from "graphql-request";
import { ethers } from "ethers";
import { subgraphFetchAllById, subgraphFetchOne } from "./query";

const spectra =
  "https://subgraph.satsuma-prod.com/93c7f5423489/perspective/spectra-mainnet/api";

interface GraphQLQuery {
  query: string;
  collection: string;
}

interface Share {
  id: string;
  portfolio: Portfolio[];
}

interface Portfolio {
  balance: string;
  asset: {
    address: string;
  };
}

const SHARES_QUERY: GraphQLQuery = {
  query: gql`
    query GetAccounts($block: Int, $lastId: ID!) {
      accounts(
        where: {
          portfolio_: {
            balance_not: "0"
            asset: "0x2d176fc14374201a1641db67e5a9761bf92726f8"
          }
        }
      ) {
        id
        portfolio(
          where: {
            asset: "0x2d176fc14374201a1641db67e5a9761bf92726f8"
            id_gt: $lastId
          }
          orderBy: id
        ) {
          balance
        }
      }
    }
  `,
  collection: "accounts"
};

export async function fetchSpectraPoolShares(block: number): Promise<Share[]> {
  return await subgraphFetchAllById<Share>(
    spectra,
    SHARES_QUERY.query,
    SHARES_QUERY.collection,
    { block: block }
  );
}
