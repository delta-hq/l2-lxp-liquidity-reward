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

export interface UserPositions {
  [contractId: string]: {
    [user: string]: number;
  };
}

interface UserReserve {
  amount0: bigint;
  amount1: bigint;
  token0: string;
  token1: string;
}

export interface UserReserves {
  [user: string]: {
    [contractId: string]: UserReserve;
  };
}

export interface CumulativePositions {
  [contractId: string]: number;
}

export type UserPosition = {
  block_number: number;
  timestamp: number;
  user: string;
  token: string;
  balance: bigint;
};

export interface Sync {
  contractId_: string;
  reserve0: number;
  reserve1: number;
  timestamp_: string;
}

export interface Transaction {
  from: string;
  to: string;
  value: number;
  contractId_: string;
  transactionHash_: string;
}

export interface Reserves {
  [key: string]: {
    reserve0: number;
    reserve1: number;
  };
}

interface TokenInfo {
  token0: string;
  token1: string;
}

export interface PoolTokens {
  [contractId: string]: TokenInfo;
}
