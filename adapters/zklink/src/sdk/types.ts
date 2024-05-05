export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export type OutputSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: string;
    token_symbol?: string;
    usd_price?: number;
};

export type UserPositions = {
    userPositions: Array<{
        id: string;
        balances: Array<{
            id: string;
            balance: string
            token: string;
        }>,
        positions: Array<{
            id: string;
            pool: string;
            token: string;
            supplied: string;
        }>
    }>
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
