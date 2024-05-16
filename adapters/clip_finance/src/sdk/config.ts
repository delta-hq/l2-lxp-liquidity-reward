export const enum CHAINS {
  LINEA = 59144,
}

export const SUBGRAPH_URLS = {
  [CHAINS.LINEA]:
    "https://api.goldsky.com/api/public/project_cltzfe75l0y4u01s98n3c7fmu/subgraphs/clip-finance-shares-token/v2.4/gn",
};

export const RESERVE_SUBGRAPH_URLS = {
  [CHAINS.LINEA]:
    "https://api.goldsky.com/api/public/project_cltzfe75l0y4u01s98n3c7fmu/subgraphs/clip-finance-shares-token/v2.5/gn",
  
}

export const RPC_URLS = {
  [CHAINS.LINEA]: 
    "https://rpc.linea.build",
};