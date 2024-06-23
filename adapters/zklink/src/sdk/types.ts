export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}


export type UserBalance = {
    userAddress: string,
    poolAddress: string
    tokenAddress: string
    blockNumber: number
    balance: bigint
}

export type LPMap = Map<string, {
    tokenAddress: string,
    userAddress: string,
    balance: bigint
}>

export type UserPosition = {
    userPositions: {
        id: string;
        balances: {
            balance: string,
            token: string
        }[]
    }[]
}

export interface Pool {
    id: string,
    balance: string,
    decimals: string,
    poolName: string,
    symbol: string,
    totalSupplied: string,
    underlying: string
}
