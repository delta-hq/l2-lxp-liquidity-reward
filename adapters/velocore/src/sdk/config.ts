export const enum CHAINS {
  L2_CHAIN_ID = 59144,
}
export const enum PROTOCOLS {
  VELOCORE = 0,
}

export const enum AMM_TYPES {
  VELOCORE = 0,
}

export const SUBGRAPH_URLS = {
  [CHAINS.L2_CHAIN_ID]: {
    [PROTOCOLS.VELOCORE]: {
      [AMM_TYPES.VELOCORE]:
        "https://graph-query.linea.build/subgraphs/name/velocore",
    },
  },
};
export const RPC_URLS = {
  [CHAINS.L2_CHAIN_ID]: "https://rpc.linea.build",
};
