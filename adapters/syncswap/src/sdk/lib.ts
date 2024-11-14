import {V2_SUBGRAPH_URL, client} from "./config"
import { UserPosition } from "./types"
import {Decimal} from 'decimal.js'


type V2Position = {
    id: string,
    liquidityTokenBalance: string,
    user: {
        id: string,
    },
    pair: {
        totalSupply: string,
        reserve0: string,
        reserve1: string,
        token0: {
            id: string,
            symbol: string,
            decimals: string
        },
        token1: {
            id: string,
            symbol: string,
            decimals: string
        }
        token0Price: string,
        token1Price: string
    }
}

const BD10_ = new Decimal(10)
const BD18 = new Decimal(10).pow(18)
const getV2PositionReserves = (position: V2Position) => {
    const liquidityTokenBalanceBN = BigInt(new Decimal(position.liquidityTokenBalance).mul(BD18).toHex())
    const totalSupplyBN = BigInt(new Decimal(position.pair.totalSupply).mul(BD18).toHex())
    if(totalSupplyBN === BigInt(0)) return {reserve0: BigInt(0), reserve1: BigInt(0)}
    return {
        reserve0: BigInt(new Decimal(position.pair.reserve0).mul(BD10_.pow(position.pair.token0.decimals)).toHex()) * liquidityTokenBalanceBN / totalSupplyBN,
        reserve1: BigInt(new Decimal(position.pair.reserve1).mul(BD10_.pow(position.pair.token1.decimals)).toHex()) * liquidityTokenBalanceBN / totalSupplyBN,
    }
}

export const getV2UserPositionsAtBlock = async (blockNumber: number): Promise<UserPosition[]> => {
    let result: UserPosition[] = []

    let skip = 0
    let fetchNext = true
    let lastLiquidityTokenBalance = '0.000000000000000001'
    const uniqueMap = new Set<string>();
    while (fetchNext) {
        console.log(`fetching SyncSwap liquidityPositions size:${uniqueMap.size}, lastLiquidityTokenBalance: ${lastLiquidityTokenBalance}`)
        const query = `query {
            liquidityPositions(
                first: 1000,
                skip: ${skip},
                where: { liquidityTokenBalance_gte: ${lastLiquidityTokenBalance} },
                block: { number: ${blockNumber} },
                orderBy: liquidityTokenBalance,
                orderDirection: asc
            ) {
                id
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
        }`

        const jsonData = await retry(() => {
            return fetch(V2_SUBGRAPH_URL, {
                method: "POST",
                body: JSON.stringify({ query }),
                headers: { "Content-Type": "application/json" },
            }).then(res => res.json());
        }, 10);

        const liquidityPositions: V2Position[] = [];
        if(jsonData.hasOwnProperty('data') && jsonData.data.hasOwnProperty('liquidityPositions')) {
            liquidityPositions.push(...jsonData.data.liquidityPositions)
        }
        result.push(...liquidityPositions.filter(lp => !uniqueMap.has(lp['id']) && uniqueMap.add(lp['id'])).map((position: V2Position) => {
            const { reserve0, reserve1 } = getV2PositionReserves(position)
            return {
                    user: position.user.id,
                    token0: {
                        address: position.pair.token0.id,
                        balance: reserve0,
                        symbol: position.pair.token0.symbol,
                        usdPrice: position.pair.token0Price
                    },
                    token1: {
                        address: position.pair.token1.id,
                        balance: reserve1,
                        symbol: position.pair.token1.symbol,
                        usdPrice: position.pair.token1Price
                    }
                } as UserPosition
        }));
        if (liquidityPositions.length < 1000) {
            fetchNext = false;
        } else {
            skip += 1000;
        }
        if(skip > 5000) {
            lastLiquidityTokenBalance = liquidityPositions[liquidityPositions.length - 1].liquidityTokenBalance
            skip = 0
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

export const retry = function<T> (promiseFn: () => Promise<T>, times = 3): Promise<Awaited<T>> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        while (times--) {
            try {

                const ret = await promiseFn();
                resolve(ret);
                break;
            } catch (error) {
                if (!times) reject(error);
            }
        }
    });
};