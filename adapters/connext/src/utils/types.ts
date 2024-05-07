// Function inputs
export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

// Outputs
export type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string; // token symbol should be empty string if it is not available
    usd_price: number; // assign 0 if not available
};

// Subgraph entity
export type LpAccountBalanceHourly = {
    amount: string;
    account: {
        id: string;
    }
    modified: string;
    block: string;
    token: {
        id: string;
        symbol: string;
    }
}

// Subgraph query result
export type SubgraphResult = {
    lpAccountBalanceHourlies: LpAccountBalanceHourly[];
}