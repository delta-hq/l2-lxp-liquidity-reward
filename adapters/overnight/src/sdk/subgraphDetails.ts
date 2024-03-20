import BigNumber from "bignumber.js";
import { AMM_TYPES, CHAINS, OVNPOOLS, PROTOCOLS, SUBGRAPH_URLS } from "./config";
// import fetch from "node-fetch";

export interface Position{
    id: string;
    liquidity: bigint;
    owner: string;
    pool: string;
};


export interface PositionWithUSDValue extends Position{
    token0USDValue: string;
    token1USDValue: string;
    token0AmountsInWei: bigint;
    token1AmountsInWei: bigint;
    token0DecimalValue: number;
    token1DecimalValue: number;
}
    
// OVN pools
// 0x58aacbccaec30938cb2bb11653cad726e5c4194a usdc/usd+
// 0xc5f4c5c2077bbbac5a8381cf30ecdf18fde42a91 usdt+/usd+
export const getPositionsForAddressByPoolAtBlock = async (
    blockNumber: number,
    address: string,
    poolId: string,
    chainId: CHAINS,
    protocol: PROTOCOLS,
): Promise<Position[]> => {
    let whereQuery = blockNumber ? `where: { blockNumber_lt: ${blockNumber} }` : "";

    let skip = 0;
    let fetchNext = true;

    const allPoolsRes = await Promise.all(Object.values(SUBGRAPH_URLS[chainId][protocol]).map(async (_) => {
        const url = _.url
        const poolId = _.pool
        let result: Position[] = [];

        while(fetchNext){
            let query = `{
                deposits(${whereQuery} orderBy: amount, first: 1000,skip: ${skip}) {
                    id
                    amount
                    user
                    blockNumber
                }
            }`;

            let response = await fetch(url, {
                method: "POST",
                body: JSON.stringify({ query }),
                headers: { "Content-Type": "application/json" },
            });
            let data = await response.json();

            let positions = data.data.deposits;
            for (let i = 0; i < positions.length; i++) {
                let position = positions[i];
                let transformedPosition: Position = {
                    id: position.id,
                    liquidity: BigInt(position.amount),
                    owner: position.user,
                    pool: poolId,
                };
                result.push(transformedPosition);
                
            }
            if(positions.length < 1000){
                fetchNext = false;
            }else{
                skip += 1000;
            }
        }

        return result
    }))

    return allPoolsRes.flat(1);
}

export const getLPValueByUserAndPoolFromPositions = (
    positions: Position[]
): Map<string, Map<string, BigNumber>> => {
    let result = new Map<string, Map<string, BigNumber>>();
    for (let i = 0; i < positions.length; i++) {
        let position = positions[i];
        let poolId = position.id;
        let owner = position.owner;
        let userPositions = result.get(owner);
        if (userPositions === undefined) {
            userPositions = new Map<string, BigNumber>();
            result.set(owner, userPositions);
        }
        let poolPositions = userPositions.get(poolId);
        if (poolPositions === undefined) {
            poolPositions = BigNumber(0);
        }

        poolPositions = poolPositions.plus(position.liquidity.toString());
        userPositions.set(poolId, poolPositions);
    }
    return result;
}
