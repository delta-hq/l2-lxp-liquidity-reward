import { SUBGRAPH_URL } from "./config";
import { UserPosition } from "./types";

type V2Position = {
  owner: string;
  liquidity: string;
  pool: {
    totalSupply: string;
    reserve0: string;
    reserve1: string;
    token0: string;
    token1: string;
  };
};

const getV2PositionReserves = (position: V2Position) => {
  return {
    reserve0:
      (BigInt(position.pool.reserve0) * BigInt(position.liquidity)) /
      BigInt(position.pool.totalSupply),
    reserve1:
      (BigInt(position.pool.reserve1) * BigInt(position.liquidity)) /
      BigInt(position.pool.totalSupply),
  };
};

export const getV2UserPositionsAtBlock = async (
  blockNumber: number,
): Promise<UserPosition[]> => {
  const result: UserPosition[] = [];

  let skip = 0;
  let fetchNext = true;
  while (fetchNext) {
    const query = `query {
            legacyPositions(
                first: 1000,
                skip: ${skip},
                where: { liquidity_gt: 0 },
                block: { number: ${blockNumber} }
            ) {
                owner
                liquidity
                pool {
                    token0
                    token1
                    reserve0
                    reserve1
                    totalSupply
                }
            }
        }`;

    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });

    const {
      data: { legacyPositions },
    } = await response.json();

    result.push(
      ...legacyPositions.map((position: V2Position) => {
        const { reserve0, reserve1 } = getV2PositionReserves(position);
        return {
          user: position.owner,
          token0: {
            address: position.pool.token0,
            balance: reserve0,
          },
          token1: {
            address: position.pool.token1,
            balance: reserve1,
          },
        };
      }),
    );

    if (legacyPositions.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }

  return result;
};

type V3Position = {
  owner: string;
  liquidity: string;
  tickLower: string;
  tickUpper: string;
  pool: {
    sqrtPriceX96: string;
    tick: string;
    token0: string;
    token1: string;
  };
};

const getV3PositionReserves = (position: V3Position) => {
  const liquidity = +position.liquidity;
  const sqrtPriceQ96 = +position.pool.sqrtPriceX96;
  const currentTick = +position.pool.tick;
  const tickLower = +position.tickLower;
  const tickUpper = +position.tickUpper;

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
  const sqrtPrice = sqrtPriceQ96 / 2 ** 96;

  // Only return active TVL
  if (currentTick >= tickLower && currentTick < tickUpper) {
    reserve0 = BigInt(
      Math.floor(
        liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB)),
      ),
    );
    reserve1 = BigInt(Math.floor(liquidity * (sqrtPrice - sqrtRatioA)));
  }

  return {
    reserve0,
    reserve1,
  };
};

export const getNileV3UserPositionsAtBlock = async (
  blockNumber: number,
): Promise<UserPosition[]> => {
  const result: UserPosition[] = [];

  let skip = 0;
  let fetchNext = true;
  while (fetchNext) {
    const query = `query {
            clPositions(
                first: 1000,
                skip: ${skip},
                where: { liquidity_gt: 0 },
                block: { number: ${blockNumber} }
            ) {
                owner
                liquidity
                tickLower
                tickUpper
                pool {
                    sqrtPriceX96
                    tick
                    token0
                    token1
                }
            }
        }`;

    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });

    const {
      data: { clPositions },
    } = await response.json();

    result.push(
      ...clPositions.map((position: V3Position) => {
        const { reserve0, reserve1 } = getV3PositionReserves(position);
        return {
          user: position.owner,
          token0: {
            address: position.pool.token0,
            balance: reserve0,
          },
          token1: {
            address: position.pool.token1,
            balance: reserve1,
          },
        };
      }),
    );

    if (clPositions.length < 1000) {
      fetchNext = false;
    } else {
      skip += 1000;
    }
  }

  return result;
};
