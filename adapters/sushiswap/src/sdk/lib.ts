import { V2_SUBGRAPH_URL, V3_SUBGRAPH_URL, client } from "./config"
import { UserPosition } from "./types"

type V2Position = {
    balance: string,
    user: {
        id: string,
    },
    pair: {
        liquidity: string,
        reserve0: string,
        reserve1: string,
        token0: {
            id: string,
            symbol: string,
        },
        token1: {
            id: string,
            symbol: string,
        }
        token0Price: string,
        token1Price: string
    }
}

const getV2PositionReserves = (position: V2Position) => {
    return {
        reserve0: BigInt(position.pair.reserve0) * BigInt(position.balance) / BigInt(position.pair.liquidity),
        reserve1: BigInt(position.pair.reserve1) * BigInt(position.balance) / BigInt(position.pair.liquidity)
    }
}

export const getV2UserPositionsAtBlock = async (blockNumber: number): Promise<UserPosition[]> => {
    const result: UserPosition[] = []

    let skip = 0
    let fetchNext = true
    while (fetchNext) {
        const query = `query {
            liquidityPositions(
                first: 1000,
                skip: ${skip},
                where: { balance_gt: 0 },
                block: { number: ${blockNumber} }
            ) {
                balance
                user {
                    id
                }
                pair {
                    liquidity
                    reserve0
                    reserve1
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
            }
        }`

        const response = await fetch(V2_SUBGRAPH_URL, {
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json" },
        })
        const { data: { liquidityPositions } } = await response.json();

        result.push(...liquidityPositions.map((position: V2Position) => {
            const { reserve0, reserve1 } = getV2PositionReserves(position)
            return {
                user: position.user.id,
                token0: {
                    address: position.pair.token0.id,
                    balance: reserve0,
                    symbol: position.pair.token0.symbol,
                    usdPrice: +position.pair.token0Price
                },
                token1: {
                    address: position.pair.token1.id,
                    balance: reserve1,
                    symbol: position.pair.token1.symbol,
                    usdPrice: +position.pair.token1Price
                }
        }
        }))

        if (liquidityPositions.length < 1000) {
            fetchNext = false;
        } else {
            skip += 1000;
        }
    }

    return result
}

type V3Position = {
    liquidity: string,
    owner: string,
    pool: {
        sqrtPrice: string,
        tick: string,
        token0: {
            id: string,
            symbol: string,
        },
        token1: {
            id: string,
            symbol: string
        }
        token0Price: string,
        token1Price: string
    }
    tickLower: {
        tickIdx: string
    },
    tickUpper: {
        tickIdx: string
    },
}

const getV3PositionReserves = (position: V3Position) => {
    const liquidity = +position.liquidity
    const _sqrtPrice = +position.pool.sqrtPrice
    const currentTick = +position.pool.tick
    const tickLower = +position.tickLower.tickIdx
    const tickUpper = +position.tickUpper.tickIdx

    let reserve0 = 0n
    let reserve1 = 0n

    if (liquidity === 0) {
        return {
          reserve0,
          reserve1,
        }
    }

    const sqrtRatioA = Math.sqrt(1.0001 ** tickLower)
    const sqrtRatioB = Math.sqrt(1.0001 ** tickUpper)
    const sqrtPrice = _sqrtPrice / (2 ** 96)

    if (currentTick >= tickLower && currentTick < tickUpper) {
        reserve0 = BigInt(Math.floor(liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB))))
        reserve1 = BigInt(Math.floor(liquidity * (sqrtPrice - sqrtRatioA)))
    }
    
    return {
        reserve0,
        reserve1
    }
}

export const getV3UserPositionsAtBlock = async (blockNumber: number): Promise<UserPosition[]> => {
    const result: UserPosition[] = []

    let skip = 0
    let fetchNext = true
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
        }`

        const response = await fetch(V3_SUBGRAPH_URL, {
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json" },
        })

        const { data: { positions } } = await response.json();

        result.push(...positions.map((position: V3Position) => {
            const { reserve0, reserve1 } = getV3PositionReserves(position)
            return {
                user: position.owner,
                token0: {
                    address: position.pool.token0.id,
                    balance: reserve0,
                    symbol: position.pool.token0.symbol,
                    usdPrice: +position.pool.token0Price
                },
                token1: {
                    address: position.pool.token1.id,
                    balance: reserve1,
                    symbol: position.pool.token1.symbol,
                    usdPrice: +position.pool.token1Price
                }
            }
        }))

        if (positions.length < 1000) {
            fetchNext = false;
        } else {
            skip += 1000;
        }
    }

    return result
}

export const getTimestampAtBlock = async (blockNumber: number) => {
    const block = await client.getBlock({
        blockNumber: BigInt(blockNumber),
    });
    return Number(block.timestamp * 1000n);
};