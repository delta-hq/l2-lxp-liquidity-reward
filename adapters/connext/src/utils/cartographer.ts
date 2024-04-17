import { chainIdToDomain, domainToChainId } from "@connext/nxtp-utils";

export type PoolInformation = {
    lpToken: string;
    pooledTokens: [string, string];
    pooledTokenDecimals: [number, number];
    key: string;
    chainId: number;
}

export const MAINNET_CARTOGRAPHER_URL = `https://postgrest.mainnet.connext.ninja`

type PoolInformationResponse = {
    key: string;
    domain: string;
    lp_token: string;
    pooled_tokens: [string, string];
    pool_token_decimals: [number, number];
}

export const getPoolInformationFromLpToken = async (lpToken: string, chainId: number): Promise<PoolInformation> => {
    const url = `${MAINNET_CARTOGRAPHER_URL}/stableswap_pools?lp_token=eq.${lpToken.toLowerCase()}&domain=eq.${chainIdToDomain(chainId)}`;

    const response = await fetch(url);
    const data: PoolInformationResponse[] = await response.json();
    if (data.length > 1) {
        throw new Error(`More than one pool found for lpToken/chain: ${lpToken}/${chainId}`)
    }
    const { key, lp_token, pooled_tokens, pool_token_decimals, domain } = data[0];
    return {
        key,
        lpToken: lp_token,
        pooledTokens: pooled_tokens,
        pooledTokenDecimals: pool_token_decimals,
        chainId: domainToChainId(+domain)
    }
};