import { ASSET, SYMBOL, SUBGRAPH_URL,KEY } from "./config";

export interface OutputDataSchemaRow {
    block_number:number
    timestamp:number
    user_address:string
    token_address:string
    token_symbol:string
    token_balance:number
}


export const getUserTVLByBlock = async (
    blockNumber: number,
    timestamp: number,
):Promise<OutputDataSchemaRow[]> =>  {
    let subgraphUrl = SUBGRAPH_URL;
    let blockQuery = blockNumber !== 0 ? `block: {number: ${blockNumber}}` : ``;
    let skip = 0;
    let fetchNext = true;
    let result: OutputDataSchemaRow[] = [];     
    while (fetchNext) {
        let query = `{
            accounts(${blockQuery} first:1000,skip:${skip}){
                id
              amount
              txCount
            }   
          }
          `;
        let response = await fetch(subgraphUrl, {
            method: "POST",
            body: JSON.stringify({ query }),
            headers: { "Content-Type": "application/json","Authorization":KEY},
        });
        let data = await response.json();
        let accounts = data.data.accounts
        for (const account of accounts) {
            let userLpSnapshot:OutputDataSchemaRow = { 
                block_number:blockNumber,
                timestamp:timestamp,
                user_address:account.id,
                token_address:ASSET,
                token_symbol:SYMBOL,
                token_balance:account.amount
            }
            result.push(userLpSnapshot)
        }
        if(accounts.length < 1000){
            fetchNext = false;
        }else{
            skip += 1000;
        }
    }
       
    return result
}
