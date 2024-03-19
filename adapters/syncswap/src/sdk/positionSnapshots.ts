import {CHAINS, SUBGRAPH_URLS} from "./config";


interface LiquidityPositionSnapshot {
    account: string
    pair: {
        id: string
    }
    liquidityTokenBalance: string
    liquidityTokenTotalSupply: string
    reserveUSD: string
    block: number
}

interface SubgraphResponse {
    data: {
        liquidityPositionSnapshots: LiquidityPositionSnapshot[]
    }
}

interface UserPositionSnapshotsAtBlockData {
    user: string
    pool: string
    block: number
    position: number // Position Identify
    lpvalue: string // LP USD value
}

export const getPositionsForAddressByPoolAtBlock = async  (
    snapshotBlockNumber: number
): Promise<UserPositionSnapshotsAtBlockData[]> => {
    const userPositionSnapshotsAtBlockData:UserPositionSnapshotsAtBlockData[] = []
    let snapshotsArrays: LiquidityPositionSnapshot[] = []
    const snapshotsMap = new Map<string,Map<string,LiquidityPositionSnapshot>>() // user => pool => snapshot
    let skip = 0
    const b_end = snapshotBlockNumber
    let b_start = 0
    // eslint-disable-next-line no-constant-condition
    while(true) {
        let query = `
     query filterSnapshots {
          liquidityPositionSnapshots (
          skip: ${skip},
            first: 1000,
            orderBy: block, 
            orderDirection: asc,
            where: {
              block_gt: ${b_start},
              block_lte: ${b_end},
            }
          ) {
              pair {id}
              account
              liquidityTokenBalance
              liquidityTokenTotalSupply
              reserveUSD
              block
          }
        }
  `
        const res = await fetch(SUBGRAPH_URLS[CHAINS.LINEA],{
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json" },
        }).then(res => res.json()) as SubgraphResponse
        snapshotsArrays = snapshotsArrays.concat(res.data.liquidityPositionSnapshots)
        if(res.data.liquidityPositionSnapshots.length !== 1000) {
            break
        }
        skip += 1000
        if(skip > 5000) {
            skip = 0
            b_start = snapshotsArrays[snapshotsArrays.length - 1].block+1
        }
        writeProgress(b_end, b_start,b_end)
    }
    for(const snapshot of snapshotsArrays) {
        let userPositionSnapshotMap = snapshotsMap.get(snapshot.account)
        if(!userPositionSnapshotMap) {
            userPositionSnapshotMap = new Map<string, LiquidityPositionSnapshot>()
        }
        userPositionSnapshotMap.set(snapshot.pair.id, snapshot)
        snapshotsMap.set(snapshot.account, userPositionSnapshotMap)
    }

    snapshotsMap.forEach((userPositionSnapshotMap => {
        userPositionSnapshotMap.forEach((positionSnapshot) => {
            const share = parseFloat(positionSnapshot.liquidityTokenBalance) / parseFloat(positionSnapshot.liquidityTokenTotalSupply)
            const valueUSD = share * parseFloat(positionSnapshot.reserveUSD)
            if(valueUSD < 0.01) {
                return
            }
            userPositionSnapshotsAtBlockData.push({
                user: positionSnapshot.account,
                pool: positionSnapshot.pair.id,
                block: snapshotBlockNumber,
                position: snapshotsArrays.length,
                lpvalue: valueUSD.toFixed(2)
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