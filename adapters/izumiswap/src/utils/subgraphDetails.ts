import BigNumber from "bignumber.js";
import { AMM_TYPES, CHAINS, PROTOCOLS, RPC_URLS, SUBGRAPH_URLS } from "../config/config";
import { PositionMath } from "./positionMath";
import { createPublicClient, extractChain, http } from "viem";
import { linea } from "viem/chains";

export interface Position{
    id: string;
    liquidity: string;
    owner: string;
    pool: {
        tick: number;
        id: string;
    };
    leftPt: number;
    rightPt: number;
    tokenX: {
        id: string;
        decimals: number;
        priceUSD: number;
        name: string;
        symbol: string;
    };
    tokenY: {
        id: string;
        decimals: number;
        priceUSD: number;
        name: string;
        symbol: string;
    }
};


export interface PositionWithUSDValue extends Position{
    token0USDValue: string;
    token1USDValue: string;
    token0AmountsInWei: bigint;
    token1AmountsInWei: bigint;
    token0DecimalValue: number;
    token1DecimalValue: number;
}

export interface UserTokenBalanceInfo {
    tokenBalance: BigNumber;
    tokenSymbol: string;
    usdPrice: number;
}
    
export const getPositionsForAddressByPoolAtBlock = async (
    blockNumber: number,
    address: string,
    poolId: string,
    chainId: CHAINS,
    protocol: PROTOCOLS,
    ammType: AMM_TYPES
): Promise<Position[]> => {
    let subgraphUrl = (SUBGRAPH_URLS as any)[chainId][protocol][ammType];
    let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;
    let poolQuery = poolId !== "" ? ` pool_:{id: "${poolId.toLowerCase()}"}` : ``;
    let ownerQuery = address !== "" ? `owner: "${address.toLowerCase()}"` : ``;

    let whereQuery = ownerQuery !== "" && poolQuery !== "" ? `where: {${ownerQuery} , ${poolQuery}}` : ownerQuery !== "" ?`where: {${ownerQuery}}`: poolQuery !== "" ? `where: {${poolQuery}}`: ``;
    let lastTimestamp = 0;
    let fetchNext = true;
    let result: Position[] = [];
    while(fetchNext){
        let query = `{
            liquidities(${whereQuery} ${blockQuery} orderBy: transaction__timestamp, first:1000, where:{transaction_:{timestamp_gt:${lastTimestamp}}}) {
            id

                liquidity
                owner
                pool {
                    tick
                    id
                }
                leftPt
                rightPt
                tokenX {
                    id
                    decimals
                    priceUSD
                    name
                    symbol
                }
                tokenY {
                    id
                    decimals
                    priceUSD
                    name
                    symbol
                }
                transaction{
                    timestamp
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
        let positions = data.data.liquidities;
        for (let i = 0; i < positions.length; i++) {
            let position = positions[i];
            let transformedPosition: Position = {
                id: position.id,
                liquidity: position.liquidity,
                owner: position.owner,
                pool: {
                    tick: Number(position.pool.tick),
                    id: position.pool.id,
                },
                leftPt: position.leftPt,
                rightPt: position.rightPt,
                tokenX: {
                    id: position.tokenX.id,
                    decimals: position.tokenX.decimals,
                    priceUSD: position.tokenX.priceUSD,
                    name: position.tokenX.name,
                    symbol: position.tokenX.symbol,
                },
                tokenY: {
                    id: position.tokenY.id,
                    decimals: position.tokenY.decimals,
                    priceUSD: position.tokenY.priceUSD,
                    name: position.tokenY.name,
                    symbol: position.tokenY.symbol,
                },
            };
            result.push(transformedPosition);
            lastTimestamp = position.transaction.timestamp
            
        }
        if(positions.length < 1000){
            fetchNext = false;
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
): Promise<Position> => {
    let subgraphUrl = (SUBGRAPH_URLS as any)[chainId][protocol][ammType];
    let blockQuery = blockNumber !== 0 ? `, block: {number: ${blockNumber}}` : ``;
    let query = `{
        position(id: "${positionId}" ${blockQuery}) {
            id
            pool {
                id
                tick
            }
            leftPt
            rightPt
            }
            liquidity
            tokenX {
                id
                decimals
                priceUSD
                name
                symbol
            }
            tokenY {
                id
                decimals
                priceUSD
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
            liquidity: position.liquidity,
            owner: position.owner,
            pool: {
                tick: Number(position.pool.tick),
                id: position.pool.id,
            },
            leftPt: position.leftPt,
            rightPt: position.rightPt,
            tokenX: {
                id: position.tokenX.id,
                decimals: position.tokenX.decimals,
                priceUSD: position.tokenX.priceUSD,
                name: position.tokenX.name,
                symbol: position.tokenX.symbol,
            },
            tokenY: {
                id: position.tokenY.id,
                decimals: position.tokenY.decimals,
                priceUSD: position.tokenY.derivedUSD,
                name: position.tokenY.name,
                symbol: position.tokenY.symbol,
            },
        };

}

export const getPositionDetailsFromPosition =  (
    position: Position
):PositionWithUSDValue => {
    let leftPoint = position.leftPt;
    let rightPoint = position.rightPt;
    let liquidity = position.liquidity;
    let tick = Number(position.pool.tick);
    let decimalX = position.tokenX.decimals;
    let decimalY = position.tokenY.decimals;
    let tokenXDerivedUSD = position.tokenX.priceUSD;
    let tokenYDerivedUSD = position.tokenY.priceUSD;
    // let token0AmountsInWei = PositionMath.getToken0Amount(tick, tickLow, tickHigh, sqrtPriceX96, liquidity);
    // let token1AmountsInWei = PositionMath.getToken1Amount(tick, tickLow, tickHigh, sqrtPriceX96, liquidity);

    let amountResult = PositionMath.getLiquidityValue({liquidity, leftPoint, rightPoint, decimalX, decimalY}, tick)

    let token0AmountsInWei = BigInt(amountResult.amountX.toFixed())
    let token1AmountsInWei = BigInt(amountResult.amountY.toFixed())

    let token0DecimalValue = amountResult.amountXDecimal;
    let token1DecimalValue = amountResult.amountYDecimal;
    
    let token0UsdValue = new BigNumber(token0DecimalValue.toString()).multipliedBy(tokenXDerivedUSD).toFixed(4);
    let token1UsdValue = new BigNumber(token1DecimalValue.toString()).multipliedBy(tokenYDerivedUSD).toFixed(4);

    return {...position, token0USDValue: token0UsdValue, token1USDValue: token1UsdValue, token0AmountsInWei, token1AmountsInWei, token0DecimalValue, token1DecimalValue};

}

export const getLPValueByUserAndPoolFromPositions = (
    positions: Position[]
): Map<string, Map<string, UserTokenBalanceInfo>> => {
    let result = new Map<string, Map<string, UserTokenBalanceInfo>>();
    for (let i = 0; i < positions.length; i++) {
        let position = positions[i];
        let tokenXAddress = position.tokenX.id;
        let tokenYAddress = position.tokenY.id;
        let owner = position.owner;
        if (owner == '0x0000000000000000000000000000000000000000') continue;
        let userPositions = result.get(owner);
        if (userPositions === undefined) {
            userPositions = new Map<string, UserTokenBalanceInfo>();
            result.set(owner, userPositions);
        }

        let tokenXAmount = userPositions.get(tokenXAddress);
        if (tokenXAmount === undefined) {
            tokenXAmount = {tokenBalance: new BigNumber(0), tokenSymbol: position.tokenX.symbol, usdPrice: 0};
        }

        let tokenYAmount = userPositions.get(tokenYAddress);
        if (tokenYAmount === undefined) {
            tokenYAmount = {tokenBalance: new BigNumber(0), tokenSymbol: position.tokenY.symbol, usdPrice: 0};
        }

        let positionWithUSDValue = getPositionDetailsFromPosition(position);
        tokenXAmount.tokenBalance = tokenXAmount.tokenBalance.plus(new BigNumber(positionWithUSDValue.token0DecimalValue));  
        tokenYAmount.tokenBalance = tokenYAmount.tokenBalance.plus(new BigNumber(positionWithUSDValue.token1DecimalValue));

        userPositions.set(tokenXAddress, tokenXAmount);
        userPositions.set(tokenYAddress, tokenYAmount);
    }
    return result;
}

export const getTimestampAtBlock = async (blockNumber: number) => {
    const publicClient = createPublicClient({
      chain: extractChain({ chains: [linea], id: CHAINS.LINEA }),
      transport: http(RPC_URLS[CHAINS.LINEA]),
    });
  
    const block = await publicClient.getBlock({
      blockNumber: BigInt(blockNumber),
    });
    return Number(block.timestamp * 1000n);
};