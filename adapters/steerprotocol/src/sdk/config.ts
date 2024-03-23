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
        [PROTOCOLS.STEER]:  "https://subgraph.steer.finance/linea/subgraphs/name/steerprotocol/steer-linea"
    }
}
export const RPC_URLS = {
    [CHAINS.L2_CHAIN_ID]: "https://rpc.linea.build",
};