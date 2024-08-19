export type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: number;
    token_symbol: string;
    usd_price: number;
  };
  
  export interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
  }
  
  export interface AccountBalances {
    [userAddress: string]: {
      [tokenAddress: string]: {
        symbol: string;
        balance: number;
      };
    };
  }