import { ASSET, SYMBOL, SUBGRAPH_URL,KEY,PRICE } from "./config";

export interface OutputDataSchemaRow {
    block_number:number
    timestamp:number
    user_address:string
    token_address:string
    token_symbol:string
    token_balance:bigint
    usd_price: number
}

export const queryUserTVLByBlock = async (
    blockNumber: number,
    timestamp: number,
):Promise<OutputDataSchemaRow[]> =>  {
    let subgraphUrl = SUBGRAPH_URL;
    let blockQuery = blockNumber !== 0 ? ` block: {number: ${blockNumber}}` : ``;
    let skip = 0;
    let fetchNext = true;
    let result: OutputDataSchemaRow[] = [];
    while(fetchNext){
        let query = `{
            userLpSnapshots(${blockQuery} orderBy: timestamp, first:1000,skip:${skip}){
              id
              user
              block
              timestamp
              lpAmount
            }    
          }
          `;
        
        let response = await fetch(subgraphUrl, {
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json","Authorization":KEY},
        });
        let data = await response.json();
        let snapshots = data.data.userLpSnapshots
        for (const snapshot of snapshots) {
            let userLpSnapshot:OutputDataSchemaRow = {
                block_number:snapshot.block,
                timestamp:snapshot.timestamp,
                user_address:snapshot.user,
                token_address:ASSET,
                token_symbol:SYMBOL,
                token_balance:snapshot.lpAmount,
                usd_price: PRICE
            }             
            result.push(userLpSnapshot)
        }
        if(snapshots.length < 1000){
            fetchNext = false;
        }else{
            skip += 1000;
        }
    }
    return result
}
// getSnapshotsForAddressAtBlock(0,'')