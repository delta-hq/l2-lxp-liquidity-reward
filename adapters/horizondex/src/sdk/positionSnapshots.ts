import {CHAINS, SUBGRAPH_URLS} from "./config";
import {getTokenPricingSnapshots} from "./tokenPricingSnapshot";
import {findClosestTokenSnapshot} from "./utils";


interface PositionSnapshot {
    owner: string
    pool: {
        id: string
        token0: {
            id: string
            symbol: string
        }
        token1: {
            id: string
            symbol: string
        }
    }
    depositedToken0: string
    depositedToken1: string
    withdrawnToken0: string
    withdrawnToken1: string
    liquidity: string
    blockNumber: number
    timestamp: number
}

interface SubgraphResponse {
    data: {
        positionSnapshots: PositionSnapshot[]
    }
}

interface UserPositionSnapshotsAtBlockData {
    block_number: number
    timestamp: string
    user_address: string
    token_address: string
    token_symbol: string
    token_balance: string
    usd_price: string
}

const STABLES = ["0x176211869ca2b568f2a7d4ee941e073a821ee1ff"]

export const getPositionsForAddressByPoolAtBlock = async  (
    snapshotBlockNumber: number
): Promise<UserPositionSnapshotsAtBlockData[]> => {
    const userPositionSnapshotsAtBlockData:UserPositionSnapshotsAtBlockData[] = []
    let snapshotsArrays: PositionSnapshot[] = []
    let maxTimestamp = 0
    const snapshotsMap = new Map<string,Map<string,PositionSnapshot>>() // user => pool => snapshot
    let skip = 0
    const b_end = snapshotBlockNumber
    let b_start = 0
    // eslint-disable-next-line no-constant-condition
    while(true) {
        let query = `
     query filterSnapshots {
          positionSnapshots (
          skip: ${skip},
            first: 1000,
            orderBy: blockNumber, 
            orderDirection: asc,
            where: {
              blockNumber_gt: ${b_start},
              blockNumber_lte: ${b_end},
            }
          ) {
               pool {
                id
                token0 {
                id
                symbol
                }
                token1 {
                id
                symbol
                }
              }
              depositedToken0
              depositedToken1
              withdrawnToken0
              withdrawnToken1
              owner
              liquidity
              blockNumber
              timestamp
          }
        }
  `
        const res = await fetch(SUBGRAPH_URLS[CHAINS.LINEA],{
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json" },
        }).then(res => res.json()) as SubgraphResponse

        snapshotsArrays = snapshotsArrays.concat(res.data.positionSnapshots)
        if(res.data.positionSnapshots.length == 0) {
            break
        }
        skip += 1000
        writeProgress(b_end, b_start,b_end)
    }
    for(const snapshot of snapshotsArrays) {
        let userPositionSnapshotMap = snapshotsMap.get(snapshot.owner)
        if(!userPositionSnapshotMap) {
            userPositionSnapshotMap = new Map<string, PositionSnapshot>()
        }
        userPositionSnapshotMap.set(snapshot.pool.id, snapshot)
        snapshotsMap.set(snapshot.owner, userPositionSnapshotMap)
        if (snapshot.timestamp > maxTimestamp) {
            maxTimestamp = snapshot.timestamp
        }
    }

    //getting token pricing snapshot for positions usd values
    const tokenPricingSnapshots = await getTokenPricingSnapshots(maxTimestamp)

    snapshotsMap.forEach((userPositionSnapshotMap => {
        userPositionSnapshotMap.forEach((positionSnapshot) => {
            const token0UsdSnapshot = STABLES.includes(positionSnapshot.pool.token0.id) ? {
                priceUSD: "1.0",
                periodStartUnix: "0",
                token: {
                    id: positionSnapshot.pool.token0.id
                }
            } : findClosestTokenSnapshot(tokenPricingSnapshots.get(positionSnapshot.pool.token0.id), positionSnapshot.timestamp)
            const token1UsdSnapshot = STABLES.includes(positionSnapshot.pool.token1.id) ? {
                priceUSD: "1.0",
                periodStartUnix: "0",
                token: {
                    id: positionSnapshot.pool.token1.id
                }
            } : findClosestTokenSnapshot(tokenPricingSnapshots.get(positionSnapshot.pool.token1.id), positionSnapshot.timestamp)
            const token0Amount = parseFloat(positionSnapshot.depositedToken0) - parseFloat(positionSnapshot.withdrawnToken0);
            const token1Amount = parseFloat(positionSnapshot.depositedToken1) - parseFloat(positionSnapshot.withdrawnToken1);

            const token0UsdPrice = parseFloat(token0UsdSnapshot?.priceUSD || "0");
            const token1UsdPrice = parseFloat(token1UsdSnapshot?.priceUSD || "0");
            const valueUSD = token0Amount * token0UsdPrice + token1Amount * token1UsdPrice
            if(valueUSD < 0.01) {
                return
            }
            userPositionSnapshotsAtBlockData.push({
                user_address: positionSnapshot.owner,
                timestamp: new Date(positionSnapshot.timestamp * 1000).toISOString(),
                token_address: positionSnapshot.pool.id,
                block_number: snapshotBlockNumber,
                token_symbol: `${positionSnapshot.pool.token0.symbol}/${positionSnapshot.pool.token1.symbol} HZN NFT`,
                token_balance: positionSnapshot.liquidity,
                usd_price: valueUSD.toString()
            })
        })
    }))
    return userPositionSnapshotsAtBlockData
}


function writeProgress(endBlock: number,numCompleted: number, total: number): void {
    const percentage_progress = (numCompleted / total * 100).toFixed(2);
    const filled_bar = Math.floor(parseFloat(percentage_progress) / 10);
    const empty_bar = 10 - filled_bar;
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`Block ${endBlock} - Progress:[${'#'.repeat(filled_bar)}${'-'.repeat(empty_bar)}] ${percentage_progress}%`);
}
