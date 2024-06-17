const TOKEN_ADDRESS = "0x3478de5e82431676c87113001bbeeb359cb5eaa5";
const TOKEN_SYMBOL = 'miweETH';

const GRAPHQL_ENDPOINT = "https://api.goldsky.com/api/public/project_clxioqhjdzy1901wmgqmp2ygj/subgraphs/mitosis-linea-lxp/1.0.0/gn";

const makeQuery = (blockNumber: number) => `query MyQuery {
  tokenBalances(block: {number: ${blockNumber}}) {
    value
    id
  }
}`;

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

interface TokenBalance {
  value: string;
  id: string;
}

interface TokenBalancesResponse {
  tokenBalances: TokenBalance[];
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

async function post<T = any>(url: string, data: any): Promise<{ data: T }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

export const getUserTVLByBlock = async (blocks: BlockData): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = blocks

  const { data: { tokenBalances } } = await post<TokenBalancesResponse>(GRAPHQL_ENDPOINT, makeQuery(blockNumber));

  const output = tokenBalances.map((v) => ({
    block_number: blockNumber,
    timestamp: blockTimestamp,
    user_address: v.id,
    token_address: TOKEN_ADDRESS,
    token_balance: BigInt(v.value),
    token_symbol: TOKEN_SYMBOL,
    usd_price: 0
  }));

  return output;
};
