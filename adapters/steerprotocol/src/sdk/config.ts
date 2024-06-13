export const enum CHAINS{
    L2_CHAIN_ID = 59144,
}
export const enum PROTOCOLS{
    STEER = 0,
}

export const enum AMM_TYPES{
    UNISWAPV3 = 0,
}

export const SUBGRAPH_URLS = {
    [CHAINS.L2_CHAIN_ID]: {
        [PROTOCOLS.STEER]:  "https://api.goldsky.com/api/public/project_clohj3ta78ok12nzs5m8yag0b/subgraphs/steer-protocol-linea/1.1.1/gn"
    }
}
export const RPC_URLS = {
    [CHAINS.L2_CHAIN_ID]: "https://rpc.linea.build",
};