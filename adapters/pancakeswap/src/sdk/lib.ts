import { V3_SUBGRAPH_URL, client } from './config';
import { UserPosition } from './types';

type V3Position = {
  id: string;
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

  if (currentTick >= tickLower && currentTick < tickUpper) {
    reserve0 = BigInt(
      Math.floor(
        liquidity *
          ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB)),
      ),
    );
    reserve1 = BigInt(
      Math.floor(liquidity * (sqrtPrice - sqrtRatioA)),
    );
  }

  return {
    reserve0,
    reserve1,
  };
};

export const getV3UserPositionsAtBlock = async (
  blockNumber: number,
): Promise<UserPosition[]> => {
  const result: UserPosition[] = [];

  let skip = 0;
  let fetchNext = true;
  while (fetchNext) {
    const query = `query {
            positions(
                first: 1000,
                where: { liquidity_gt: 0, id_gt: ${skip} },
                block: { number: ${blockNumber} },
                orderBy: id
            ) {
                id
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
      method: 'POST',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    });

    const { data } = await response.json();

    const { positions } = data;

    result.push(
      ...positions.map((position: V3Position) => {
        const { reserve0, reserve1 } =
          getV3PositionReserves(position);
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
      }),
    );

    if (positions.length < 1000) {
      fetchNext = false;
    } else {
      skip = positions[positions.length - 1].id;
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
