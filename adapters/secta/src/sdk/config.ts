export const enum CHAINS {
    LINEA = 59144,
}
export const enum PROTOCOLS{
    SECTA = 0,
}

export const enum AMM_TYPES{
    SECTAV3 = 0,
    SECTAV2 = 1,
}

export const SUBGRAPH_URLS = {
    [CHAINS.LINEA]: {
        [PROTOCOLS.SECTA]: {
            [AMM_TYPES.SECTAV3]:
                //"https://api.studio.thegraph.com/query/66239/secta-linea-exchange-v3/version/latest",
                "https://gateway-arbitrum.network.thegraph.com/api/3700f7806f624898da7631bb01f5253f/subgraphs/id/DQz9g5ZRSiprkXXCRwRSTjh6J5gsRMuhr8TymEo1pZe6",
            [AMM_TYPES.SECTAV2]:
                //"https://api.studio.thegraph.com/query/66239/secta-linea-exchange-v2/version/latest",
                "https://gateway-arbitrum.network.thegraph.com/api/3700f7806f624898da7631bb01f5253f/subgraphs/id/4YKqZQ3pH5wZ3seW2ojc1o5HxoJVYQ6UBdunW8ovJCBz",
        },
    },
};
export const RPC_URLS = {
    [CHAINS.LINEA]: "https://rpc.linea.build/",
};