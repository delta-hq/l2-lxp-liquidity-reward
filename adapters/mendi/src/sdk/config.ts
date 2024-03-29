export const enum CHAINS {
  LINEA = 59144,
}

export const enum PROTOCOLS {
  MENDI = 1,
}

export const SUBGRAPH_URLS = {
  [CHAINS.LINEA]: {
    [PROTOCOLS.MENDI]: {
      url: "https://api.goldsky.com/api/public/project_cltshpix6kkj301x1b4ilh6pm/subgraphs/mendi-linea/1.2/gn",
    },
  },
};

export const RPC_URLS = {
  [CHAINS.LINEA]: "https://rpc.linea.build",
};

export const SNAPSHOTS_BLOCKS = [3210170];
