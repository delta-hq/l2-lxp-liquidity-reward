import { V2_SUBGRAPH_URL, client } from "./config"
import { UserPosition } from "./types"

type V2Position = {
    liquidityTokenBalance: string,
    user: {
        id: string,
    },
    pair: {
        totalSupply: string,
        reserve0: string,
        reserve1: string,
        reserveUSD: string,
        token0: {
            id: string,
            symbol: string,
            decimals: number,
        },
        token1: {
            id: string,
            symbol: string,
            decimals: number,
        }
        token0Price: string,
        token1Price: string
    }
}

const getV2PositionReserves = (position: V2Position) => {
    return {
        reserve0: Number(position.pair.reserve0) * Number(position.liquidityTokenBalance) / Number(position.pair.totalSupply),
        reserve1: Number(position.pair.reserve1) * Number(position.liquidityTokenBalance) / Number(position.pair.totalSupply)
    }
}

const getV2UsdPositionReserves = (position: V2Position) => {
    let sideRv = (Number(position.pair.reserveUSD) / Number(2)) * Number(position.liquidityTokenBalance) / Number(position.pair.totalSupply);
    return {
        reserveUsd0: sideRv,
        reserveUsd1: sideRv
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
                    reserveUSD
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
        }`

        // console.log(query)

        const response = await fetch(V2_SUBGRAPH_URL, {
            method: "POST",
            body: JSON.stringify({ query }),
            headers: {
                "Content-Type": "application/json",
                //Authorization: `Bearer ${process.env.V2_SUBGRAPH_TOKEN}`,
            },
        })
        const { data: { liquidityPositions } } = await response.json();

        result.push(...liquidityPositions.map((position: V2Position) => {
            const { reserve0, reserve1 } = getV2PositionReserves(position)
            const { reserveUsd0, reserveUsd1 } = getV2UsdPositionReserves(position)
            return {
                user: position.user.id,
                token0: {
                    address: position.pair.token0.id,
                    balance: reserve0,
                    balanceUsd: reserveUsd0,
                    symbol: position.pair.token0.symbol,
                    decimals: position.pair.token0.decimals,
                    usdPrice: (Number(position.pair.reserveUSD) / Number(2)) / Number(position.pair.reserve0)
                },
                token1: {
                    address: position.pair.token1.id,
                    balance: reserve1,
                    balanceUsd: reserveUsd1,
                    symbol: position.pair.token1.symbol,
                    decimals: position.pair.token0.decimals,
                    usdPrice: (Number(position.pair.reserveUSD) / Number(2)) / Number(position.pair.reserve1)
                }
        }
        }))

        if (liquidityPositions.length < 1000) {
            fetchNext = false;
        } else {
            skip += 1000;
        }
    }

    //console.log(result)

    return result
}

export const getTimestampAtBlock = async (blockNumber: number) => {
    const block = await client.getBlock({
        blockNumber: BigInt(blockNumber),
    });
    return Number(block.timestamp * 1000n);
};