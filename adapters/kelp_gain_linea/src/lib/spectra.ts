import { gql } from "graphql-request";
import { subgraphFetchAllById, subgraphFetchOne } from "./query";
import { rsEthToAgEth } from "./fetcher";
import { SPECTRA_START_BLOCK } from "./utils";

export const SPECTRA_YT_ADDRESS = "0x2d176fc14374201a1641db67e5a9761bf92726f8"; // 20521549 (YT-agETH-1739404813) Aug-13-2024 06:39:11 PM UTC

export const SPECTRA_LP_ADDRESS = "0xfe469c17898082dbdc1e969fb36fe4e7c56b5014";

const spectra =
  "https://subgraph.satsuma-prod.com/93c7f5423489/perspective/spectra-mainnet/api";

interface GraphQLQuery {
  query: string;
  collection: string;
}

interface Share {
  id: string;
  portfolio: Portfolio[];
  pool: Pool;
}

interface Pool {
  lpTotalSupply: string;
  ibtAsset: {
    amount: string;
    asset: {
      address: string;
    };
  };
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
            asset_in: [
              "0x2d176fc14374201a1641db67e5a9761bf92726f8"
              "0xfe469c17898082dbdc1e969fb36fe4e7c56b5014"
            ]
          }
        }
      ) {
        id
        portfolio(
          where: {
            balance_not: "0"
            asset_in: [
              "0x2d176fc14374201a1641db67e5a9761bf92726f8"
              "0xfe469c17898082dbdc1e969fb36fe4e7c56b5014"
            ]
            id_gt: $lastId
          }
          orderBy: id
        ) {
          asset {
            address
          }
          balance
        }
      }
    }
  `,
  collection: "accounts"
};

const POOL_QUERY: GraphQLQuery = {
  query: gql`
    query GetAccounts($block: Int) {
      pool(id: "0x952ac974ff2f3ee5c05534961b661fe70fd38b8a") {
        lpTotalSupply
        ibtAsset {
          amount
          asset {
            address
          }
        }
      }
    }
  `,
  collection: "pool"
};

export async function fetchSpectraPoolShares(block: number) {
  if (block < SPECTRA_START_BLOCK) {
    return [];
  }
  const shares = await subgraphFetchAllById<Share>(
    spectra,
    SHARES_QUERY.query,
    SHARES_QUERY.collection,
    { block: block }
  );

  return await convertToAgEth(block, shares);
}

async function convertToAgEth(blockNumber: number, spectraShare: Share[]) {
  const rsEthRate = await rsEthToAgEth(blockNumber);

  const pool = await subgraphFetchOne<Pool>(
    spectra,
    POOL_QUERY.query,
    POOL_QUERY.collection,
    { block: blockNumber }
  );
  const ibtAmount = BigInt(pool.ibtAsset.amount);
  const lpTotalSupply = BigInt(pool.lpTotalSupply);

  const shares = spectraShare.map((e) => {
    const ytAccounts = e.portfolio.filter(
      (token) => token.asset.address == SPECTRA_YT_ADDRESS
    );

    const lpAccounts = e.portfolio.filter(
      (token) => token.asset.address == SPECTRA_LP_ADDRESS
    );

    let totalYTBalance = ytAccounts.reduce(
      (acc, s) => acc + BigInt(s.balance),
      0n
    );

    let totalLPBalance = lpAccounts.reduce(
      (acc, s) => acc + BigInt(s.balance),
      0n
    );

    let ytBalanceInAgEth =
      (BigInt(totalYTBalance) * BigInt(rsEthRate)) / BigInt(10 ** 18);
    let lpBalanceInAgEth = (BigInt(totalLPBalance) * ibtAmount) / lpTotalSupply;

    const balance = ytBalanceInAgEth + lpBalanceInAgEth;
    return {
      id: e.id,
      balance: balance.toString()
    };
  });

  if (shares.length == 0) {
    throw new Error(`Empty share Spectra BLOCK: ${blockNumber}`);
  }

  return shares;
}
