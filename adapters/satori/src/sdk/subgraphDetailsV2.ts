import { ASSET, SYMBOL, SUBGRAPH_URL } from "./config";

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
    let result: OutputDataSchemaRow[] = [];
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
            headers: { "Content-Type": "application/json" },
        });
        let data = await response.json();
        console.log(data);
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
    return result
}
