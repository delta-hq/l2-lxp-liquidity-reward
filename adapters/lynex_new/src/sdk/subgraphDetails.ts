import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";
import { GAUGE_SUBGRAPH_URL, client } from "./config";

export interface UserStake {
  id: string;
  pools: any[];
  liquidityPositions: LiquidityPosition[];
}
export interface Gauge {
  id: string;
  pool: string;
  token0: {
    id: string;
    symbol: string;
  };
  token1: {
    id: string;
    symbol: string;
  };
}

export interface Token {
  symbol: string;
  id: string;
}

export interface GaugePosition {
  id: string;
  token0: Token;
  token1: Token;
  pool: string;
}

export interface LiquidityPosition {
  id: string;
  gauge: GaugePosition;
  amount: string;
  userToken0: string;
  userToken1: string;
  userToken0Decimals: string;
  userToken1Decimals: string;
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
    let userStakes = data.data?.users ?? [];
    for (let i = 0; i < userStakes.length; i++) {
      let userStake = userStakes[i];
      let transformedUserStake: UserStake = {
        id: userStake.id,
        pools: userStake.liquidityPositions.map((lp: any) => lp.gauge.pool),
        liquidityPositions: userStake.liquidityPositions,
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

export async function getGauges(blockNumber: number): Promise<Gauge[]> {

  let subgraphUrl = GAUGE_SUBGRAPH_URL;
  const blockQuery =
    blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;

  let skip = 0;
  let fetchNext = true;
  const result: Gauge[] = [];
  while (fetchNext) {
    const query = `
            query GaugesQuery {
              gauges(${blockQuery} first:1000,skip:${skip}) {
                id
                pool
                token0 {
                  id
                  symbol
                }
                token1 {
                  id
                  symbol
                }
              }
            }`;

    const response = await fetch(subgraphUrl, {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    const gauges = data.data.gauges;
    for (let i = 0; i < gauges.length; i++) {
      const gauge = gauges[i];
      result.push(gauge);
    }
    if (gauges.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }
  return result;
}

export const getTimestampAtBlock = async (blockNumber: number) => {
  const publicClient = client;

  const block = await publicClient.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};
