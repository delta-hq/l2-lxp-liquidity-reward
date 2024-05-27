import {CHAINS, SUBGRAPH_URLS} from "./config";

export interface TokenPricingSnapshot {
    priceUSD: string
    periodStartUnix: number
    token: {
        id: string
    }
}

interface SubgraphResponse {
    data: {
        tokenHourDatas: TokenPricingSnapshot[]
    }
}


export const getTokenPricingSnapshots = async  (
    maxTimestamp: number
): Promise<Map<string, TokenPricingSnapshot[]>> => {
    let snapshotsArrays: TokenPricingSnapshot[] = []
    const snapshotsMap = new Map<string, TokenPricingSnapshot[]>() // token -> snapshots
    let skip = 0
    const t_end = maxTimestamp
    let t_start = 0
    // eslint-disable-next-line no-constant-condition
    while(true) {
        let query = `
     query filterSnapshots {
          tokenHourDatas (
          skip: ${skip},
            first: 1000,
            orderBy: periodStartUnix,
            orderDirection: asc,
            where: {
              periodStartUnix_gt: ${t_start},
              periodStartUnix_lte: ${t_end},
            }
          ) {
            priceUSD
            id
            periodStartUnix
            token {
              id
            }
          }
        }
  `
        const res = await fetch(SUBGRAPH_URLS[CHAINS.LINEA],{
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json" },
        }).then(res => res.json()) as SubgraphResponse
        snapshotsArrays = snapshotsArrays.concat(res.data.tokenHourDatas)
        if(res.data.tokenHourDatas.length == 0) {
            break
        }
        skip += 1000
    }
    for(const snapshot of snapshotsArrays) {
        let tokenSnapshots: TokenPricingSnapshot[] | undefined = snapshotsMap.get(snapshot.token.id)
        if(!tokenSnapshots) {
            tokenSnapshots = []
        }
        tokenSnapshots.push(snapshot)
        snapshotsMap.set(snapshot.token.id, tokenSnapshots)
    }

    let snapshotsMapSorted = new Map<string, TokenPricingSnapshot[]>;
    snapshotsMap.forEach((tokenSnapshots, tokenId) => {
        tokenSnapshots.sort((item) => item.periodStartUnix)
        //snapshotsMapSorted.set(tokenId, tokenSnapshots.sort())
    })
    return snapshotsMap
}


