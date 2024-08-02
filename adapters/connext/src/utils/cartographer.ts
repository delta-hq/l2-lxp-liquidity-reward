import { chainIdToDomain, domainToChainId } from "@connext/nxtp-utils";
import { BlockData, OutputDataSchemaRow, RouterEventResponse } from "./types";
import { parseUnits } from "viem";

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

export const poolInfo = new Map<string, PoolInformation>();

export const getPoolInformationFromLpToken = async (lpToken: string, chainId: number): Promise<PoolInformation> => {
    if (poolInfo.has(lpToken.toLowerCase())) {
        return poolInfo.get(lpToken.toLowerCase())!;
    }
    const url = `${MAINNET_CARTOGRAPHER_URL}/stableswap_pools?lp_token=eq.${lpToken.toLowerCase()}&domain=eq.${chainIdToDomain(chainId)}`;

    const response = await fetch(url);
    const data: PoolInformationResponse[] = await response.json();
    if (data.length > 1) {
        throw new Error(`More than one pool found for lpToken/chain: ${lpToken}/${chainId}`)
    }
    const { key, lp_token, pooled_tokens, pool_token_decimals, domain } = data[0];
    const ret = {
        key,
        lpToken: lp_token,
        pooledTokens: pooled_tokens,
        pooledTokenDecimals: pool_token_decimals,
        chainId: domainToChainId(+domain)
    }
    poolInfo.set(lpToken.toLowerCase(), ret);
    return ret;
};


export const getRouterBalanceAtBlock = async (block: number, interval = 1000, account?: string) => {
    let hasMore = true;
    let offset = 0;
    const balances = new Map<string, RouterEventResponse[]>()

    while (hasMore) {
        const liquidityEvents = await getRouterLiquidityEvents(interval, block, account)
        appendCartographerData(liquidityEvents, balances);
        hasMore = liquidityEvents.length === interval;
        offset += interval;
    }
    return [...balances.values()].flat();
};

const appendCartographerData = (toAppend: RouterEventResponse[], existing: Map<string, RouterEventResponse[]>) => {
    // get the latest record for each account. map should be keyed on router address,
    // and store an array of locked router balances
    toAppend.forEach((entry) => {
        // no tally for account, set and continue
        if (!existing.has(entry.router.toLowerCase())) {
            existing.set(entry.router.toLowerCase(), [entry]);
            return;
        }

        // get the existing record for the router
        const prev = existing.get(entry.router.toLowerCase())!;
        // get the asset idx for this event
        const idx = prev.findIndex((r) => r.asset.toLowerCase() === entry.asset.toLowerCase());
        if (idx < 0) {
            // no record for this asset. append entry to existing list
            existing.set(entry.router.toLowerCase(), [...prev, entry]);
            return;
        }

        // if the existing record is more recent, exit without updating
        if (prev[idx].block_number >= entry.block_number) {
            return;
        }
        prev[idx] = entry;
        existing.set(entry.router.toLowerCase(), prev.filter((_, i) => idx !== i).concat([entry]));
    });
}

export const getRouterLiquidityEvents = async (
    limit: number,
    blockNumber: number,
    router?: string
): Promise<RouterEventResponse[]> => {
    const url = `${MAINNET_CARTOGRAPHER_URL}/router_liquidity_events?block_number=lte.${blockNumber}&limit=eq.${limit}${router ? `&router=eq.${router}` : ''}`;
    const response = await fetch(url);
    const data: RouterEventResponse[] = await response.json();
    return data;
}

type AssetConfiguration = {
    local: string;
    adopted: string;
    canonical_id: string;
    canonical_domain: string;
    domain: string;
    key: string;
    id: string;
    decimal: number;
    adopted_decimal: number
};

export const getAssets = async (): Promise<AssetConfiguration[]> => {
    const url = `${MAINNET_CARTOGRAPHER_URL}/assets?domain=eq.1818848877`;
    const response = await fetch(url);
    return await response.json() as AssetConfiguration[];
}

export const formatRouterLiquidityEvents = async (block: BlockData, data: RouterEventResponse[]): Promise<OutputDataSchemaRow[]> => {
    // Get the asset information
    const assets = await getAssets();

    // Format the data
    return data.map(d => {
        const config = assets.find(a => a.local.toLowerCase() === d.asset.toLowerCase());
        const decimals = config ? config.decimal : 18;
        const toParse = d.balance < 0 ? 0 : d.balance;
        const balance = toParse.toString().includes('e') ? BigInt(toParse * 10 ** 18) : parseUnits(toParse.toString(), decimals)
        return {
            block_number: block.blockNumber,
            timestamp: block.blockTimestamp,
            user_address: d.router,
            token_address: config ? config.adopted : d.asset.toLowerCase(),
            token_balance: balance,
            token_symbol: '',
            usd_price: 0
        }
    })
}