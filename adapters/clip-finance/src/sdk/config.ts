export const enum CHAINS {
  LINEA = 59144,
}

export const SUBGRAPH_URLS = {
  [CHAINS.LINEA]:
    "https://api.goldsky.com/api/public/project_cltzfe75l0y4u01s98n3c7fmu/subgraphs/clip-finance-shares-token/v2.5/gn",
   //"http://localhost:8000/subgraphs/name/clip-finance-shares-token"
};

export const RPC_URLS = {
  [CHAINS.LINEA]: 
    "https://rpc.linea.build",
    //"http://0.0.0.0:8545"
};