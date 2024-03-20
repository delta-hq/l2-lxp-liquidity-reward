export const enum CHAINS {
  LINEA = 59144,
}

export const SUBGRAPH_URLS = {
  [CHAINS.LINEA]:
    "https://api.goldsky.com/api/public/project_cltzfe75l0y4u01s98n3c7fmu/subgraphs/clip-finance-shares-token/v1/gn",
};

export const ASSETS = {
  [CHAINS.LINEA]: {
    symbol: "CF",
    address: "0xDD49bF14cAAE7a22bb6a58A76C4E998054859D9a",
  },
};
export const RPC_URLS = {
  [CHAINS.LINEA]: "https://rpc.linea.build",
};
