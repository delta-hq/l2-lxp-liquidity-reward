//const BEEFY_LRT_SUBGRAPH_URL =

import { Hex } from "viem";

//  "https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/lrt-linea/gn";
const BEEFY_LRT_SUBGRAPH_URL =
  "https://api.0xgraph.xyz/subgraphs/name/beefyfinance/lrt-linea";
const PAGE_SIZE = 1000;

type ShareTokenBalance = {
  user_address: Hex;
  vault_address: Hex;
  shares_balance: bigint;
};

type QueryResult = {
  investorPositions: {
    investor: {
      id: Hex;
    };
    vault: {
      sharesToken: {
        id: Hex;
      };
      underlyingToken: {
        id: Hex;
        symbol: string;
      };
    };
    rawSharesBalance: string;
  }[];
};

export const getVaultShareTokenBalances = async (
  blockNumber: bigint
): Promise<ShareTokenBalance[]> => {
  let allPositions: ShareTokenBalance[] = [];
  let skip = 0;
  while (true) {
    const query = `
      query ($blockNumber: Int!, $skip: Int!, $first: Int!) {
        investorPositions(
          block: {number: $blockNumber}
          where: {rawSharesBalance_gt: 0}
          skip: $skip,
          first: $first
        ) {
          investor {
            id
          }
          vault {
            sharesToken {
              id
            }
            underlyingToken {
              id
            }
          }
          rawSharesBalance
        }
      }
    `;

    const response = await fetch(BEEFY_LRT_SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({
        query,
        variables: {
          skip,
          first: PAGE_SIZE,
          blockNumber: Number(blockNumber),
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const { data } = (await response.json()) as { data: QueryResult };

    allPositions = allPositions.concat(
      data.investorPositions.map(
        (position): ShareTokenBalance => ({
          shares_balance: BigInt(position.rawSharesBalance),
          user_address: position.investor.id.toLocaleLowerCase() as Hex,
          vault_address:
            position.vault.sharesToken.id.toLocaleLowerCase() as Hex,
        })
      )
    );

    if (data.investorPositions.length < PAGE_SIZE) {
      break;
    }

    skip += PAGE_SIZE;
  }

  return allPositions;
};
