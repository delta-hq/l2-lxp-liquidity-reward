export interface IOmniStakingResponse {
  data: {
    tokenBalances: IOmniStakingData[];
  };
}

export interface IOmniStakingData {
  id: string;
  balance_omni: string;
  balance_omni_lp: string;
}

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

export interface ILPResponse {
    data: {
        userReserves: IUserReserve[];
    };
}

export interface IUserReserve {
    user: {
        id: string;
    };
    currentTotalDebt: string;
    currentATokenBalance: string;
    reserve: {
        underlyingAsset: string;
        symbol: string;
        name: string;
    };
    liquidityRate: "0";
}
