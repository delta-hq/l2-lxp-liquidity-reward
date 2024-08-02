import {client, POOL_ADDRESS, SUBGRAPH_URL} from "./config"
import {UserPosition} from "./types"
import Decimal from "decimal.js";
import {parseAbi} from "viem";

type UserLPCollect = {
    recipient: string,
    lPToken: {
        address: string,
        symbol: string,
    },
    pairIndex: number,
    lpAmount: string,
}

const getPositionReserves = (position: UserLPCollect, lPSupplies: Map<string, bigint>, poolReserves: Map<number, PoolReserve>): {
    token0: { address: string, balance: bigint, symbol: string },
    token1: { address: string, balance: bigint, symbol: string }
} => {
    const totalSupply = lPSupplies.get(position.lPToken.address);
    let token0Balance = BigInt(0);
    let token1Balance = BigInt(0);

    const poolReserve = poolReserves.get(position.pairIndex);
    if (!poolReserve) {
        return {
            token0: {address: "", balance: BigInt(0), symbol: ""},
            token1: {address: "", balance: BigInt(0), symbol: ""}
        };
    }
    if (totalSupply && totalSupply > BigInt(0)) {
        const p = new Decimal(position.lpAmount).div(new Decimal(totalSupply.toString()));
        token0Balance = BigInt(p.mul(poolReserve.indexTotalAmount).toFixed(0));
        token1Balance = BigInt(p.mul(poolReserve.stableTotalAmount).toFixed(0));
    }
    return {
        token0: {
            address: poolReserve.indexToken,
            balance: token0Balance,
            symbol: poolReserve.indexTokenSymbol
        },
        token1: {
            address: poolReserve.stableToken,
            balance: token1Balance,
            symbol: poolReserve.stableTokenSymbol
        },
        // token1: BigInt(new Decimal(position.pair.reserve1).mul(BD10_.pow(position.pair.token1.decimals)).toHex()) * liquidityTokenBalanceBN / totalSupplyBN,
    }
}

export const getUserPositionsAtBlock = async (blockNumber: number): Promise<UserPosition[]> => {
    const result: UserPosition[] = []

    let skip = 0
    let fetchNext = true
    while (fetchNext) {
        const query = `query {
            userLPCollects(
                first: 1000,
                skip: ${skip},
                block: { number: ${blockNumber} },
                where: {recipient_not: "0x0000000000000000000000000000000000000000"}
                orderBy: id,
                orderDirection: asc
            ) {
                recipient
                lPToken {
                  address
                  symbol
                }
                pairIndex
                lpAmount
            }
        }`

        const response = await fetch(SUBGRAPH_URL, {
            method: "POST",
            body: JSON.stringify({query}),
            headers: {"Content-Type": "application/json"},
        })
        const jsonData = await response.json();
        const positions: UserLPCollect[] = [];
        if (jsonData.data.hasOwnProperty('userLPCollects')) {
            positions.push(...jsonData.data.userLPCollects)
        }

        const mergedDataMap: { [key: string]: UserLPCollect } = {};
        positions.forEach((obj) => {
            const key = `${obj.recipient}-${obj.pairIndex}`;
            if (mergedDataMap[key]) {
                mergedDataMap[key].lpAmount = (BigInt(mergedDataMap[key].lpAmount) + BigInt(obj.lpAmount)).toString();
            } else {
                mergedDataMap[key] = {...obj};
            }
        });
        const mergedData: UserLPCollect[] = Object.values(mergedDataMap);

        const lpTokenAddresses = mergedData.reduce((acc, obj) => {
            if (!acc.includes(obj.lPToken.address)) {
                acc.push(obj.lPToken.address);
            }
            return acc;
        }, [] as string[]);

        const pairIndexes = mergedData.reduce((acc, obj) => {
            if (!acc.includes(obj.pairIndex)) {
                acc.push(obj.pairIndex);
            }
            return acc;
        }, [] as number[]);

        const lPSupplies = await getLPSupplies(lpTokenAddresses);
        const poolReserves = await getPoolReserves(pairIndexes);

        result.push(...mergedData.map((position: Omit<UserLPCollect, 'type'>) => {
            // console.log(position)
            const {token0, token1} = getPositionReserves(position, lPSupplies, poolReserves)
            return {
                user: position.recipient.toLowerCase(),
                token0: {
                    address: token0.address.toLowerCase(),
                    balance: token0.balance,
                    symbol: token0.symbol,
                },
                token1: {
                    address: token1.address.toLowerCase(),
                    balance: token1.balance,
                    symbol: token1.symbol,
                }
            }
        }))

        if (positions.length < 1000) {
            fetchNext = false;
        } else {
            skip += 1000;
        }
        if (skip > 5000) {
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

export const getLPSupplies = async (addresses: string[]) => {
    const result: Map<string, bigint> = new Map<string, bigint>();

    for (let address of addresses) {
        const totalSupply = await client.readContract({
            address: address as `0x${string}`,
            abi: parseAbi(['function totalSupply() view returns (uint256)']),
            functionName: 'totalSupply',
        });
        result.set(address, totalSupply);
    }
    return result;
};

type PoolReserve = {
    indexToken: string,
    indexTokenSymbol: string,
    stableToken: string,
    stableTokenSymbol: string,
    indexTotalAmount: string,
    stableTotalAmount: string,
}

export const getPoolReserves = async (pairIndexes: number[]) => {
    const result: Map<number, PoolReserve> = new Map();

    for (let pairIndex of pairIndexes) {
        const vault = await client.readContract({
            address: POOL_ADDRESS,
            abi: [getVaultAbi],
            functionName: 'getVault',
            args: [pairIndex],
        }) as any;
        const pair = await client.readContract({
            address: POOL_ADDRESS,
            abi: [getPairAbi],
            functionName: 'getPair',
            args: [pairIndex],
        }) as any;

        const indexTokenSymbol = await client.readContract({
            address: pair.indexToken.toString() as `0x${string}`,
            abi: parseAbi(['function symbol() view returns (string)']),
            functionName: 'symbol',
        }) as string;

        const stableTokenSymbol = await client.readContract({
            address: pair.stableToken.toString() as `0x${string}`,
            abi: parseAbi(['function symbol() view returns (string)']),
            functionName: 'symbol',
        }) as string;

        result.set(pairIndex, {
            indexToken: pair.indexToken.toString(),
            indexTokenSymbol,
            stableToken: pair.stableToken.toString(),
            stableTokenSymbol,
            indexTotalAmount: vault.indexTotalAmount.toString(),
            stableTotalAmount: vault.stableTotalAmount.toString(),
        });
    }
    return result;
};

const getVaultAbi = {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "_pairIndex",
            "type": "uint256"
        }
    ],
    "name": "getVault",
    "outputs": [
        {
            "components": [
                {
                    "internalType": "uint256",
                    "name": "indexTotalAmount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "indexReservedAmount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "stableTotalAmount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "stableReservedAmount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "averagePrice",
                    "type": "uint256"
                }
            ],
            "internalType": "struct IPool.Vault",
            "name": "vault",
            "type": "tuple"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}

const getPairAbi = {
    "inputs": [
        {
            "internalType": "uint256",
            "name": "_pairIndex",
            "type": "uint256"
        }
    ],
    "name": "getPair",
    "outputs": [
        {
            "components": [
                {
                    "internalType": "uint256",
                    "name": "pairIndex",
                    "type": "uint256"
                },
                {
                    "internalType": "address",
                    "name": "indexToken",
                    "type": "address"
                },
                {
                    "internalType": "address",
                    "name": "stableToken",
                    "type": "address"
                },
                {
                    "internalType": "address",
                    "name": "pairToken",
                    "type": "address"
                },
                {
                    "internalType": "bool",
                    "name": "enable",
                    "type": "bool"
                },
                {
                    "internalType": "uint256",
                    "name": "kOfSwap",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "expectIndexTokenP",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "maxUnbalancedP",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "unbalancedDiscountRate",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "addLpFeeP",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "removeLpFeeP",
                    "type": "uint256"
                }
            ],
            "internalType": "struct IPool.Pair",
            "name": "",
            "type": "tuple"
        }
    ],
    "stateMutability": "view",
    "type": "function"
}