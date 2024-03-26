export const enum CHAINS{
    L2_CHAIN_ID = 59144,
}
export const enum PROTOCOLS{
    METAVAULT = 0,
}

export const enum AMM_TYPES{
    UNISWAPV3 = 0,
    TRADE = 1
}

export const SUBGRAPH_URLS = {
    [CHAINS.L2_CHAIN_ID]: {
        [PROTOCOLS.METAVAULT]: {
            [AMM_TYPES.UNISWAPV3]: "https://api.studio.thegraph.com/query/55804/linea-v3/version/latest",
            [AMM_TYPES.TRADE]: "https://api.studio.thegraph.com/query/55804/linea-trade/version/latest"
        }
    },
    
}
export const RPC_URLS = {
    [CHAINS.L2_CHAIN_ID]: "https://rpc.linea.build"
}