import {CHAINS, SUBGRAPH_URLS} from "./config";
import Decimal from "decimal.js";


interface LiquidityPositionSnapshot {
    recipient: string
    lPToken: {
        id: string
        address: string
        symbol: string
    }
    pairIndex: number
    lpAmount: bigint
    block: number
    timestamp: number
}

interface SubgraphResponse {
    data: {
        userLPStats: LiquidityPositionSnapshot[]
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

export const getPositionsForAddressByPoolAtBlock = async (
    snapshotBlockNumber: number
): Promise<UserPositionSnapshotsAtBlockData[]> => {
    const userPositionSnapshotsAtBlockData: UserPositionSnapshotsAtBlockData[] = []
    let snapshotsArrays: LiquidityPositionSnapshot[] = []
    const snapshotsMap = new Map<string, Map<string, LiquidityPositionSnapshot>>() // user => pool => snapshot
    let skip = 0
    const b_end = snapshotBlockNumber
    let b_start = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
        let query = `
             query filterSnapshots {
                  userLPStats (
                  skip: ${skip},
                    first: 1000,
                    orderBy: block, 
                    orderDirection: asc,
                    where: {
                      block_gt: ${b_start},
                      block_lte: ${b_end},
                    }
                  ) {
                        lPToken {
                          address
                          symbol
                        }
                        pairIndex
                        recipient
                        lpAmount
                        timestamp
                      }
                }
            `
        const res = await fetch(SUBGRAPH_URLS[CHAINS.LINEA], {
            method: "POST",
            body: JSON.stringify({query}),
            headers: {"Content-Type": "application/json"},
        }).then(res => res.json()) as SubgraphResponse
        snapshotsArrays = snapshotsArrays.concat(res.data.userLPStats)
        if (res.data.userLPStats.length !== 1000) {
            break
        }
        skip += 1000
        if (skip > 5000) {
            skip = 0
            b_start = snapshotsArrays[snapshotsArrays.length - 1].block + 1
        }
        writeProgress(b_end, b_start, b_end)
    }
    for (const snapshot of snapshotsArrays) {
        let userPositionSnapshotMap = snapshotsMap.get(snapshot.recipient)
        if (!userPositionSnapshotMap) {
            userPositionSnapshotMap = new Map<string, LiquidityPositionSnapshot>()
        }
        userPositionSnapshotMap.set(snapshot.lPToken.id, snapshot)
        snapshotsMap.set(snapshot.recipient, userPositionSnapshotMap)
    }
    snapshotsMap.forEach((userPositionSnapshotMap => {
        userPositionSnapshotMap.forEach((positionSnapshot) => {
            console.log(positionSnapshot.timestamp)
            userPositionSnapshotsAtBlockData.push({
                user_address: positionSnapshot.recipient,
                timestamp: new Date(positionSnapshot.timestamp * 1000).toISOString(),
                token_address: positionSnapshot.lPToken.address,
                block_number: snapshotBlockNumber,
                token_symbol: positionSnapshot.lPToken.symbol,
                token_balance: new Decimal(positionSnapshot.lpAmount.toString()).div(1e18).toString(),
                usd_price: "0"
            })
        })
    }))
    return userPositionSnapshotsAtBlockData
}


function writeProgress(endBlock: number, numCompleted: number, total: number): void {
    const percentage_progress = (numCompleted / total * 100).toFixed(2);
    const filled_bar = Math.floor(parseFloat(percentage_progress) / 10);
    const empty_bar = 10 - filled_bar;
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`Block ${endBlock} - Progress:[${'#'.repeat(filled_bar)}${'-'.repeat(empty_bar)}] ${percentage_progress}%`);
}