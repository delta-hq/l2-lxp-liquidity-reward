import { PoolInformation, getPoolInformationFromLpToken } from "./cartographer";
import { LpAccountBalanceHourly, SubgraphResult } from "./types";
import { linea } from "viem/chains";
import { createPublicClient, http, parseUnits } from "viem";

export const CONNEXT_SUBGRAPH_QUERY_URL = "https://api.goldsky.com/api/public/project_clssc64y57n5r010yeoly05up/subgraphs/amarok-stableswap-analytics/1.0/gn";
export const LINEA_CHAIN_ID = 59144;
export const CONNEXT_LINEA_ADDRESS = "0xa05eF29e9aC8C75c530c2795Fa6A800e188dE0a9";

const CONNEXT_ABI = [
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "key",
                "type": "bytes32"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "calculateRemoveSwapLiquidity",
        "outputs": [
            {
                "internalType": "uint256[]",
                "name": "",
                "type": "uint256[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

const LP_HOURLY_QUERY_BY_BLOCK = (
    first: number,
    offset: number,
    blockNumber: number
): string => `
    query LpAccountBalanceHourly { 
        lpAccountBalanceHourlies(first: ${first}, offset: ${offset}, where: { block_lte: ${blockNumber} }) {
            amount
            account {
                id
            }
            modified
            block
                token {
                id
                symbol
            }
        }
    }
`

const LP_HOURLY_QUERY_BY_TIMESTAMP = (
    first: number,
    offset: number,
    timestamp: number
): string => `
    query LpAccountBalanceHourly { 
        lpAccountBalanceHourlies(first: ${first}, offset: ${offset}, where: { modified_lte: ${timestamp} }) {
            amount
            account {
                id
            }
            modified
            block
                token {
                id
                symbol
            }
        }
    }
`

const executeSubgraphQuery = async (query: string): Promise<SubgraphResult> => {
    const response = await fetch(CONNEXT_SUBGRAPH_QUERY_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ query }),
    });
    const {
        data
    } = await response.json() as { data: SubgraphResult };
    return data;
}

export const getLpAccountBalanceAtBlock = async (block: number, interval = 1000): Promise<LpAccountBalanceHourly[]> => {
    let hasMore = true;
    let offset = 0;
    const balances = new Map<string, LpAccountBalanceHourly[]>()

    while (hasMore) {
        const {
            lpAccountBalanceHourlies
        } = await executeSubgraphQuery(LP_HOURLY_QUERY_BY_BLOCK(interval, offset, block))
        appendSubgraphData(lpAccountBalanceHourlies, balances);
        hasMore = lpAccountBalanceHourlies.length === interval;
        offset += interval;
    }
    return [...balances.values()].flat();
}

export const getLpAccountBalanceAtTimestamp = async (timestamp: number, interval = 1000): Promise<LpAccountBalanceHourly[]> => {
    let hasMore = true;
    let offset = 0;
    const balances = new Map<string, LpAccountBalanceHourly[]>()

    while (hasMore) {
        const {
            lpAccountBalanceHourlies
        } = await executeSubgraphQuery(LP_HOURLY_QUERY_BY_TIMESTAMP(interval, offset, timestamp))
        appendSubgraphData(lpAccountBalanceHourlies, balances);
        hasMore = lpAccountBalanceHourlies.length === interval;
        offset += interval;
    }


    return [...balances.values()].flat();
}

type CompositeBalanceHourly = LpAccountBalanceHourly & {
    underlyingTokens: [string, string];
    underlyingBalances: [string, string];
}

export const getCompositeBalances = async (data: LpAccountBalanceHourly[]): Promise<CompositeBalanceHourly[]> => {
    // get lp token balances
    const poolInfo = new Map<string, PoolInformation>();

    // get pool info
    await Promise.all(data.map(async d => {
        const poolId = d.token.id.toLowerCase();
        if (poolInfo.has(poolId)) {
            return;
        }
        const pool = await getPoolInformationFromLpToken(d.token.id, LINEA_CHAIN_ID);
        poolInfo.set(poolId, pool);
    }));

    // get contract interface
    const client = createPublicClient({ chain: linea, transport: http() });

    // get composite balances
    const balances = await Promise.all(data.map(async ({ token, amount }) => {
        const poolId = token.id.toLowerCase();
        const pool = poolInfo.get(poolId);
        if (!pool) {
            throw new Error(`Pool info not found for token: ${token.id}`);
        }
        // calculate the swap if you remove equal
        const withdrawn = await client.readContract({
            address: CONNEXT_LINEA_ADDRESS,
            functionName: "calculateRemoveSwapLiquidity",
            args: [pool.key, parseUnits(amount, 18)],
            abi: CONNEXT_ABI
        }) as [bigint, bigint];
        return withdrawn.map(w => w.toString());
    }));

    // return composite balance object
    return data.map((d, idx) => {
        const { pooledTokens } = poolInfo.get(d.token.id.toLowerCase())!;
        return {
            ...d,
            underlyingTokens: pooledTokens,
            underlyingBalances: balances[idx] as [string, string]
        }
    })
}

const appendSubgraphData = (data: LpAccountBalanceHourly[], existing: Map<string, LpAccountBalanceHourly[]>) => {
    // looking for latest record of account balance
    data.forEach(d => {
        // if there is no tally for account, set and continue
        if (!existing.has(d.account.id.toLowerCase())) {
            existing.set(d.account.id.toLowerCase(), [d]);
            return;
        }

        // if there is an existing entry for the account, use the latest record for given asset
        const existingData = existing.get(d.account.id.toLowerCase())!;
        // get user asset entry if exists
        const assetIdx = existingData.findIndex(e => e.token.id.toLowerCase() === d.token.id.toLowerCase());
        if (assetIdx < 0) {
            // data is latest for asset
            existing.set(d.account.id.toLowerCase(), [...existingData, d]);
            return;
        }

        // if existing data is latest, do nothing
        if (+existingData[assetIdx].modified > +d.modified) {
            return;
        }

        // update the latest record
        existing.set(
            d.account.id.toLowerCase(),
            existingData.filter((_, idx) => idx !== assetIdx).concat([d])
        );
        return existing;

    })
}

export const getBlock = async (blockNumber: number) => {
    const client = createPublicClient({ chain: linea, transport: http() });
    const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
    return block;
}