import { Hex } from "viem";
import { BEEFY_SUBGRAPH_URL, SUBGRAPH_PAGE_SIZE } from "../../config";

type TokenBalance = {
  user_address: Hex;
  token_address: Hex;
  balance: bigint;
};

type QueryResult = {
  tokenBalances: {
    account: {
      id: Hex;
    };
    token: {
      id: Hex;
    };
    amount: string;
  }[];
};

export const getTokenBalances = async (
  blockNumber: bigint
): Promise<TokenBalance[]> => {
  let allPositions: TokenBalance[] = [];
  let skip = 0;
  while (true) {
    const query = `
      query LineaUser($blockNumber: Int!, $skip: Int!, $first: Int!) {
        tokenBalances(
          block: {number: $blockNumber}
          first: $first
          where: { amount_gt: 0 }
          skip: $skip
        ) {
          account {
            id
          }
          token {
            id
          }
          amount
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
      res.data.tokenBalances.map(
        (position): TokenBalance => ({
          balance: BigInt(position.amount),
          user_address: position.account.id.toLocaleLowerCase() as Hex,
          token_address: position.token.id.toLocaleLowerCase() as Hex,
        })
      )
    );

    if (res.data.tokenBalances.length < SUBGRAPH_PAGE_SIZE) {
      break;
    }

    skip += SUBGRAPH_PAGE_SIZE;
  }

  return allPositions;
};
