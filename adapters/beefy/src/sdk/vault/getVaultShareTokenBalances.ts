import { Hex } from "viem";
import { BEEFY_SUBGRAPH_URL, SUBGRAPH_PAGE_SIZE } from "../../config";

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
      query LineaUser($blockNumber: Int!, $skip: Int!, $first: Int!) {
        investorPositions(
          block: {number: $blockNumber}
          first: $first
          where: { rawSharesBalance_gt: 0 }
          skip: $skip
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

    const response = await fetch(BEEFY_SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({
        query,
        variables: {
          skip,
          first: SUBGRAPH_PAGE_SIZE,
          blockNumber: Number(blockNumber),
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(await response.text());
      throw new Error("Subgraph query failed with status " + response.status);
    }

    const res = (await response.json()) as { data: QueryResult };
    if (!res.data) {
      console.error(res);
      throw new Error("Subgraph query failed");
    }

    allPositions = allPositions.concat(
      res.data.investorPositions.map(
        (position): ShareTokenBalance => ({
          shares_balance: BigInt(position.rawSharesBalance),
          user_address: position.investor.id.toLocaleLowerCase() as Hex,
          vault_address:
            position.vault.sharesToken.id.toLocaleLowerCase() as Hex,
        })
      )
    );

    if (res.data.investorPositions.length < SUBGRAPH_PAGE_SIZE) {
      break;
    }

    skip += SUBGRAPH_PAGE_SIZE;
  }

  return allPositions;
};
