export const enum CHAINS{
    L2_CHAIN_ID = 0,
}
export const enum PROTOCOLS{
    PROTOCOL_NAME = 0,
}

export const enum AMM_TYPES{
    UNISWAPV3 = 0,
}

export const SUBGRAPH_URLS = {
    [CHAINS.L2_CHAIN_ID]: {
        [PROTOCOLS.PROTOCOL_NAME]: {
            [AMM_TYPES.UNISWAPV3]: "subgraph url here"
        }
    }
}
export const RPC_URLS = {
    [CHAINS.L2_CHAIN_ID]: "https://rpc.goldsky.com"
}