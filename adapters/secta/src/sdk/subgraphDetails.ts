import BigNumber from "bignumber.js";
import { AMM_TYPES, CHAINS, PROTOCOLS, SUBGRAPH_URLS } from "./config";
import { PositionMath } from "./utils/positionMath";
import { LiquidityMap, TokenLiquidityInfo, LiquidityInfo, getOrCreateTokenLiquidityInfo } from "./liquidityTypes";




export interface V3Position{
    id: string;
    liquidity: bigint;
    owner: string;
    pool: {
        sqrtPrice: bigint;
        tick: number;
        id: string;
    };
    tickLower: {
        tickIdx: number;
    };
    tickUpper: {
        tickIdx: number;
    };

    token0: {
        id: string;
        decimals: number;
        derivedUSD: number;
        name: string;
        symbol: string;
    };
    token1: {
        id: string;
        decimals: number;
        derivedUSD: number;
        name: string;
        symbol: string;
    }
};


export interface V3PositionWithUSDValue extends V3Position{
    token0USDValue: string;
    token1USDValue: string;
    token0AmountsInWei: bigint;
    token1AmountsInWei: bigint;
    token0DecimalValue: number;
    token1DecimalValue: number;
}

export interface V2Pair{
    id: string;
    token0: {
        id: string;
        decimals: number;
    };
    token1: {
        id: string;
        decimals: number;
    }
    reserve0: number;
    reserve1: number;
    totalSupply: number;
}

export interface V2MintedUserAddresses{
    [token: string]: Set<string>;
}

export const getPositionsForAddressByPoolAtBlock = async (
    blockNumber: number,
    address: string,
    poolId: string,
    chainId: CHAINS,
    protocol: PROTOCOLS,
    ammType: AMM_TYPES
): Promise<V3Position[]> => {
    let subgraphUrl = SUBGRAPH_URLS[chainId][protocol][ammType];
    let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;
    let poolQuery = poolId !== "" ? ` pool_:{id: "${poolId.toLowerCase()}"}` : ``;
    let ownerQuery = address !== "" ? `owner: "${address.toLowerCase()}"` : ``;

    let whereQuery = ownerQuery !== "" && poolQuery !== "" ? `where: {${ownerQuery} , ${poolQuery}}` : ownerQuery !== "" ?`where: {${ownerQuery}}`: poolQuery !== "" ? `where: {${poolQuery}}`: ``;
    let skip = 0;
    let fetchNext = true;
    let result: V3Position[] = [];
    while(fetchNext){
        let query = `{
            positions(${whereQuery} ${blockQuery} orderBy: transaction__timestamp, first:1000,skip:${skip}) {
            id

                liquidity
                owner
                pool {
                    sqrtPrice
                    tick
                    id
                }
                tickLower{
                    tickIdx
                }
                tickUpper{
                    tickIdx
                }
                token0 {
                    id
                    decimals
                    derivedUSD
                    name
                    symbol
                }
                token1 {
                    id
                    decimals
                    derivedUSD
                    name
                    symbol
                }
            },
            _meta{
                    block{
                    number
                }
            }
        }`;

       // console.log(query)

        let response = await fetch(subgraphUrl, {
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json" },
        });
        let data = await response.json();
        let positions = data.data.positions;
        for (let i = 0; i < positions.length; i++) {
            let position = positions[i];
            let transformedPosition: V3Position = {
                id: position.id,
                liquidity: BigInt(position.liquidity),
                owner: position.owner,
                pool: {
                    sqrtPrice: BigInt(position.pool.sqrtPrice),
                    tick: Number(position.pool.tick),
                    id: position.pool.id,
                },
                tickLower: {
                    tickIdx: Number(position.tickLower.tickIdx),
                },
                tickUpper: {
                    tickIdx: Number(position.tickUpper.tickIdx),
                },
                token0: {
                    id: position.token0.id,
                    decimals: position.token0.decimals,
                    derivedUSD: position.token0.derivedUSD,
                    name: position.token0.name,
                    symbol: position.token0.symbol,
                },
                token1: {
                    id: position.token1.id,
                    decimals: position.token1.decimals,
                    derivedUSD: position.token1.derivedUSD,
                    name: position.token1.name,
                    symbol: position.token1.symbol,
                },
            };
            result.push(transformedPosition);
            
        }
        if(positions.length < 1000){
            fetchNext = false;
        }else{
            skip += 1000;
        }
    }
    return result;
}


export const getPositionAtBlock = async (
    blockNumber: number,
    positionId: number,
    chainId: CHAINS,
    protocol: PROTOCOLS,
    ammType: AMM_TYPES
): Promise<V3Position> => {
    let subgraphUrl = SUBGRAPH_URLS[chainId][protocol][ammType];
    let blockQuery = blockNumber !== 0 ? `, block: {number: ${blockNumber}}` : ``;
    let query = `{
        position(id: "${positionId}" ${blockQuery}) {
            id
            pool {
                sqrtPrice
                tick
            }
            tickLower{
                tickIdx
            }
            tickUpper{
                tickIdx
            }
            liquidity
            token0 {
                id
                decimals
                derivedUSD
                name
                symbol
            }
            token1 {
                id
                decimals
                derivedUSD
                name
                symbol
            }
        },
        _meta{
                block{
                number
            }
        }
    }`;
    let response = await fetch(subgraphUrl, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let position = data.data.position;


    return  {
            id: position.id,
            liquidity: BigInt(position.liquidity),
            owner: position.owner,
            pool: {
                sqrtPrice: BigInt(position.pool.sqrtPrice),
                tick: Number(position.pool.tick),
                id: position.pool.id,
            },
            tickLower: {
                tickIdx: Number(position.tickLower.tickIdx),
            },
            tickUpper: {
                tickIdx: Number(position.tickUpper.tickIdx),
            },
            token0: {
                id: position.token0.id,
                decimals: position.token0.decimals,
                derivedUSD: position.token0.derivedUSD,
                name: position.token0.name,
                symbol: position.token0.symbol,
            },
            token1: {
                id: position.token1.id,
                decimals: position.token1.decimals,
                derivedUSD: position.token1.derivedUSD,
                name: position.token1.name,
                symbol: position.token1.symbol,
            },
        };
}

export const getPositionDetailsFromPosition =  (
    position: V3Position
):V3PositionWithUSDValue => {
    let tickLow = position.tickLower.tickIdx;
    let tickHigh = position.tickUpper.tickIdx;
    let liquidity = position.liquidity;
    let sqrtPriceX96 = position.pool.sqrtPrice;
    let tick = Number(position.pool.tick);
    let decimal0 = position.token0.decimals;
    let decimal1 = position.token1.decimals;
    let token0DerivedUSD = position.token0.derivedUSD;
    let token1DerivedUSD = position.token1.derivedUSD;
    let token0AmountsInWei = PositionMath.getToken0Amount(tick, tickLow, tickHigh, sqrtPriceX96, liquidity);
    let token1AmountsInWei = PositionMath.getToken1Amount(tick, tickLow, tickHigh, sqrtPriceX96, liquidity);

    let token0DecimalValue = Number(token0AmountsInWei) / 10 ** decimal0;
    let token1DecimalValue = Number(token1AmountsInWei) / 10 ** decimal1;
    
    let token0UsdValue = BigNumber(token0AmountsInWei.toString()).multipliedBy(token0DerivedUSD).div(10 ** decimal0).toFixed(4);
    let token1UsdValue = BigNumber(token1AmountsInWei.toString()).multipliedBy(token1DerivedUSD).div(10 ** decimal1).toFixed(4);


    return {...position, token0USDValue: token0UsdValue, token1USDValue: token1UsdValue, token0AmountsInWei, token1AmountsInWei, token0DecimalValue, token1DecimalValue};

}

export const getLPValueByUserAndPoolFromPositions = (
    positions: V3Position[]
): LiquidityInfo => {
    let result: LiquidityInfo = {};
    for (let i = 0; i < positions.length; i++) {
        let position = positions[i];
        let poolId = position.pool.id;
        let owner = position.owner;
        let token0 = position.token0.id;
        let token0Decimals = position.token0.decimals;
        let token1 = position.token1.id;
        let token1Decimals = position.token1.decimals;

        let token0LiquidityInfo = getOrCreateTokenLiquidityInfo(result, owner, token0, token0Decimals)
        let token1LiquidityInfo = getOrCreateTokenLiquidityInfo(result, owner, token1, token1Decimals)

        let positionWithUSDValue = getPositionDetailsFromPosition(position);

        token0LiquidityInfo.amount = BigNumber(token0LiquidityInfo.amount).plus(BigNumber(positionWithUSDValue.token0DecimalValue)).toNumber()
        token1LiquidityInfo.amount = BigNumber(token1LiquidityInfo.amount).plus(BigNumber(positionWithUSDValue.token1DecimalValue)).toNumber()

    }
    return result;
}

export const getV2Pairs = async (
    blockNumber: number,
    chainId: CHAINS,
    protocol: PROTOCOLS,
    ammType: AMM_TYPES
): Promise<V2Pair[]> => {
    let subgraphUrl = SUBGRAPH_URLS[chainId][protocol][ammType];
    let blockQuery = blockNumber !== 0 ? `, block: {number: ${blockNumber}}` : ``;
    let query = `{
        pairs (block: {number: ${blockNumber}}){
          id
          token1 {
            id
            decimals
          }
          token0 {
            id
            decimals
          }
          reserve0
          reserve1
          totalSupply
        }
      }`;

    let response = await fetch(subgraphUrl, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let pairs: any[] = data.data.pairs;

    let rv: V2Pair[] = []

    for (let i = 0; i < pairs.length; i++) {
        rv.push({
            id: pairs[i].id,
            token0: {
                id: pairs[i].token0.id,
                decimals: pairs[i].token0.decimals,
            },
            token1: {
                id: pairs[i].token1.id,
                decimals: pairs[i].token1.decimals,
            },
            totalSupply: pairs[i].totalSupply,
            reserve0: pairs[i].reserve0,
            reserve1: pairs[i].reserve1,

        })
    }
    return rv;
}

export const getMintedAddresses = async (
    blockNumber: number,
    chainId: CHAINS,
    protocol: PROTOCOLS,
    ammType: AMM_TYPES
): Promise<V2MintedUserAddresses> => {
    let subgraphUrl = SUBGRAPH_URLS[chainId][protocol][ammType];
    let blockQuery = blockNumber !== 0 ? `, block: {number: ${blockNumber}}` : ``;
    let query = `{
        mints {
          pair {
            id
          }
          to
        }
      }`;

    let response = await fetch(subgraphUrl, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let mints: any[] = data.data.mints;

    let rv: V2MintedUserAddresses = {}

    for(let i = 0; i < mints.length; i++) {
        const tokenAddress = mints[i].pair.id;
        const userAddress = mints[i].to;

        if(!(tokenAddress in rv)){
            rv[tokenAddress] = new Set<string>();
        }

        rv[tokenAddress].add(userAddress);
    }

    return rv;
}
