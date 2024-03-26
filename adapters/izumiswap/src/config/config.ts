export const enum CHAINS{
    MODE = 34443,
    LINEA = 59144,
}
export const enum PROTOCOLS{
    SUPSWAP = 0,
    IZISWAP = 1,
}

export const enum AMM_TYPES{
    UNISWAPV3 = 0,
    IZISWAP = 1
}

export const SUBGRAPH_URLS = {
    [CHAINS.MODE]: {
        [PROTOCOLS.IZISWAP]: {
            [AMM_TYPES.IZISWAP]: "https://graph-node-api.izumi.finance/query/subgraphs/name/izi-swap-mode"
        }
    },
    [CHAINS.LINEA]: {
        [PROTOCOLS.IZISWAP]: {
            [AMM_TYPES.IZISWAP]: "https://api.studio.thegraph.com/query/24334/izumi-subgraph-linea/version/latest"
        }
    }
}
export const RPC_URLS = {
    [CHAINS.MODE]: "https://rpc.goldsky.com",
    [CHAINS.LINEA]: "https://rpc.linea.build",
}