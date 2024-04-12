import { LpAccountBalanceHourly, SubgraphResult } from "./types";

export const CONNEXT_SUBGRAPH_QUERY_URL = "https://api.goldsky.com/api/public/project_clssc64y57n5r010yeoly05up/subgraphs/amarok-stableswap-analytics/1.0/gn";

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

