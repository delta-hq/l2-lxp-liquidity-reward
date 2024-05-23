export const enum CHAINS {
  LINEA = 59144,
}

export const enum PROTOCOLS {
  LAYERBANK = 1,
}

export const SUBGRAPH_URLS = {
  [CHAINS.LINEA]: {
    [PROTOCOLS.LAYERBANK]: {
      url: "https://api.goldsky.com/api/public/project_clwadadu5rddf01xa3m0m8ep0/subgraphs/layerbank/1.0.0/gn",
    },
  },
};

export const RPC_URLS = {
  [CHAINS.LINEA]: "https://rpc.linea.build",
};
