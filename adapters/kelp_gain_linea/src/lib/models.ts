export type Result = {
  rows: Row[];
};

export type Row = {
  user: string;
  share: string;
  block_number: string;
  day: string;
};

export interface GraphQLQuery {
  query: string;
  collection: string;
}

export type UserBalanceSubgraphEntry = {
  id: string;
  balance: string;
};

export type PoolPositionSubgraphEntry = {
  pool: {
    token0Price: string;
    token1Price: string;
    totalValueLockedETH: string;
    totalValueLockedToken0: string;
    totalValueLockedToken1: string;
    token0: {
      symbol: string;
    };
    token1: {
      symbol: string;
    };
  };
};

export type UserPositionSubgraphEntry = {
  id: string;
  liquidity: string;
  owner: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
};
