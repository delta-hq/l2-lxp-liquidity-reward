export interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

export type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string;
  usd_price: number;
};

export type UserPosition = {
  block_number: number;
  timestamp: number;
  user: string;
  token: string;
  balance: bigint;
};
