export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export type OutputSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol?: string;
    usd_price?: number;
};

export type UserPosition = {
    user: string;
    token0: {
        address: string,
        balance: bigint,
    }
    token1: {
        address: string,
        balance: bigint,
    }
}