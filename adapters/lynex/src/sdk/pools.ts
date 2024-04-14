import BigNumber from "bignumber.js";
import { V2_SUBGRAPH_URL, V3_SUBGRAPH_URL, client } from "./config";
import { UserPosition } from "./types";

type V2Position = {
  liquidityTokenBalance: string;
  user: {
    id: string;
  };
  pair: {
    totalSupply: string;
    reserve0: string;
    reserve1: string;
    token0: {
      id: string;
      symbol: string;
      decimals: number;
    };
    token1: {
      id: string;
      symbol: string;
      decimals: number;
    };
    token0Price: string;
    token1Price: string;
  };
};

export const fromWei = (number: number | string, decimals = 18) =>
  new BigNumber(number).div(new BigNumber(10).pow(decimals));
export const toWei = (number: number | string, decimals = 18) =>
  new BigNumber(number).times(new BigNumber(10).pow(decimals));

const getV2PositionReserves = (position: V2Position) => {
  return {
    reserve0: BigInt(
      toWei(position.pair.reserve0, position.pair.token0.decimals)
        .times(toWei(position.liquidityTokenBalance))
        .div(toWei(position.pair.totalSupply))
        .dp(0)
        .toNumber()
    ),
    reserve1: BigInt(
      toWei(position.pair.reserve1, position.pair.token1.decimals)
        .times(toWei(position.liquidityTokenBalance))
        .div(toWei(position.pair.totalSupply))
        .dp(0)
        .toNumber()
    ),
  };
};

export const getV2UserPositionsAtBlock = async (
  blockNumber: number
): Promise<UserPosition[]> => {
  const result: UserPosition[] = [];

  let skip = 0;
  let fetchNext = true;
  while (fetchNext) {
    const query = `query {
            liquidityPositions(
                first: 1000,
                skip: ${skip},
                where: { liquidityTokenBalance_gt: 0 },
                block: { number: ${blockNumber} }
            ) {
                liquidityTokenBalance
                user {
                    id
                }
                pair {
                    totalSupply
                    reserve0
                    reserve1
                    token0 {
                        id
                        symbol
                        decimals
                    }
                    token1 {
                        id
                        symbol
                        decimals
                    }
                    token0Price
                    token1Price
                }
            }
        }`;

    const response = await fetch(V2_SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    const {
      data: { liquidityPositions },
    } = await response.json();

    result.push(
      ...liquidityPositions.map((position: V2Position) => {
        const { reserve0, reserve1 } = getV2PositionReserves(position);
        return {
          user: position.user.id,
          token0: {
            address: position.pair.token0.id,
            balance: reserve0,
            symbol: position.pair.token0.symbol,
          },
          token1: {
            address: position.pair.token1.id,
            balance: reserve1,
            symbol: position.pair.token1.symbol,
          },
        };
      })
    );

    if (liquidityPositions.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }

  return result;
};

type V3Position = {
  liquidity: string;
  owner: string;
  pool: {
    sqrtPrice: string;
    tick: string;
    token0: {
      id: string;
      symbol: string;
    };
    token1: {
      id: string;
      symbol: string;
    };
    token0Price: string;
    token1Price: string;
  };
  tickLower: {
    tickIdx: string;
  };
  tickUpper: {
    tickIdx: string;
  };
};

const getV3PositionReserves = (position: V3Position) => {
  const liquidity = +position.liquidity;
  const _sqrtPrice = +position.pool.sqrtPrice;
  const currentTick = +position.pool.tick;
  const tickLower = +position.tickLower.tickIdx;
  const tickUpper = +position.tickUpper.tickIdx;

  let reserve0 = 0n;
  let reserve1 = 0n;

  if (liquidity === 0) {
    return {
      reserve0,
      reserve1,
    };
  }

  const sqrtRatioA = Math.sqrt(1.0001 ** tickLower);
  const sqrtRatioB = Math.sqrt(1.0001 ** tickUpper);
  const sqrtPrice = _sqrtPrice / 2 ** 96;

  // Only return active TVL
  if (currentTick >= tickLower && currentTick < tickUpper) {
    reserve0 = BigInt(
      Math.floor(
        liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB))
      )
    );
    reserve1 = BigInt(Math.floor(liquidity * (sqrtPrice - sqrtRatioA)));
  }

  return {
    reserve0,
    reserve1,
  };
};

export const getV3UserPositionsAtBlock = async (
  blockNumber: number
): Promise<UserPosition[]> => {
  const result: UserPosition[] = [];

  let skip = 0;
  let fetchNext = true;
  while (fetchNext) {
    const query = `query {
            positions(
                first: 1000,
                skip: ${skip},
                where: { liquidity_gt: 0 },
                block: { number: ${blockNumber} }
            ) {
                liquidity
                owner
                pool {
                    sqrtPrice
                    tick
                    token0 {
                        id
                        symbol
                    }
                    token1 {
                        id
                        symbol
                    }
                    token0Price
                    token1Price
                }
                tickLower {
                    tickIdx
                }
                tickUpper {
                    tickIdx
                }
            }
        }`;

    const response = await fetch(V3_SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });

    const {
      data: { positions },
    } = await response.json();

    result.push(
      ...positions.map((position: V3Position) => {
        const { reserve0, reserve1 } = getV3PositionReserves(position);
        return {
          user: position.owner,
          token0: {
            address: position.pool.token0.id,
            balance: reserve0,
            symbol: position.pool.token0.symbol,
            usdPrice: +position.pool.token0Price,
          },
          token1: {
            address: position.pool.token1.id,
            balance: reserve1,
            symbol: position.pool.token1.symbol,
            usdPrice: +position.pool.token1Price,
          },
        };
      })
    );

    if (positions.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }

  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const block = await client.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};
