import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { GAUGE_SUBGRAPH_URL, client } from "./config";

interface UserStake {
  id: string;
  pools: any[];
}

export const getUserAddresses = async (
  blockNumber: number
): Promise<UserStake[]> => {
  let subgraphUrl = GAUGE_SUBGRAPH_URL;
  let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;

  let skip = 0;
  let fetchNext = true;
  let result: UserStake[] = [];
  while (fetchNext) {
    let query = `
            query UserQuery {
              users(${blockQuery} first:1000,skip:${skip}) {
                id
                liquidityPositions {
                  id
                  gauge {
                    id
                    token0 {
                      symbol
                      id
                    }
                    token1 {
                      symbol
                      id
                    }
                    pool
                  }
                  amount
                  userToken0
                  userToken1
                  userToken0Decimals
                  userToken1Decimals
                }
              }
            }`;

    let response = await fetch(subgraphUrl, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let userStakes = data.data.users;
    for (let i = 0; i < userStakes.length; i++) {
      let userStake = userStakes[i];
      let transformedUserStake: UserStake = {
        id: userStake.id,
        pools: userStake.liquidityPositions.map((lp: any) => lp.gauge.pool),
      };
      result.push(transformedUserStake);
    }
    if (userStakes.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const publicClient = client;

  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};
