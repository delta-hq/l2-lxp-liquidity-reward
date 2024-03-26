export const enum CHAINS {
  L2_CHAIN_ID = 59144,
}
export const enum PROTOCOLS {
  LYNEX = 0,
}

export const enum AMM_TYPES {
  LYNEX = 0,
}

export const SUBGRAPH_URLS = {
  [CHAINS.L2_CHAIN_ID]: {
    [PROTOCOLS.LYNEX]: {
      [AMM_TYPES.LYNEX]:
        "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/lynex-gauges/1.1.0/gn",
    },
  },
};
export const RPC_URLS = {
  [CHAINS.L2_CHAIN_ID]: "https://rpc.linea.build",
};
