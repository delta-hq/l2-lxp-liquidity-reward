export const enum CHAINS {
  MODE = 34443,
  LINEA = 59144,
}
export const enum PROTOCOLS {
  SUPSWAP = 0,
  DODOEX = 1,
}

export const enum AMM_TYPES {
  UNISWAPV3 = 0,
  DODO = 1,
}

export const SUBGRAPH_URLS = {
  [CHAINS.MODE]: {
    [PROTOCOLS.SUPSWAP]: {
      [AMM_TYPES.UNISWAPV3]:
        "https://api.goldsky.com/api/public/project_clrhmyxsvvuao01tu4aqj653e/subgraphs/supswap-exchange-v3/1.0.0/gn",
    },
  },
  [CHAINS.LINEA]: {
    [PROTOCOLS.DODOEX]: {
      [AMM_TYPES.DODO]:
        "https://api.dodoex.io/graphql?chainId=59144&schemaName=dodoex&apikey=graphqldefiLlamadodoYzj5giof",
    },
  },
};
export const RPC_URLS = {
  [CHAINS.MODE]: "https://rpc.goldsky.com",
  [CHAINS.LINEA]: "https://rpc.linea.build",
};
