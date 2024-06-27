import {gql} from "graphql-request";
import {batchSize, EXCHANGER, graphClient, usdcContract, zusdContract} from "./utils";

const getBalanceShots = gql`
    query getBalanceShots($block_number: Int) {
        tokenBalanceShots(
            first: 1000
            orderBy: block_number
            orderDirection: desc
            where: {
                block_number_lte: $block_number
            })
        {
            user_address
            token_address
            token_balance
            block_number
        }
    }`

const getHolders = gql`
    query getHolders($lastId: ID) {
        zusdholders(
            first: 1000
            where:{id_gt: $lastId}
        ){
            id
        }
    }`

export const getBalanceMap = async (blockNumber: number) => {
    let balanceMap = new Map<string, Map<string, string>>(); // user => token => balance
    let hasNext = true;
    while (hasNext) {
        console.log(`Processing staking balances before block: ${blockNumber} ...`);
        let data: any = await graphClient.request(getBalanceShots, {block_number: blockNumber});
        let tokenBalanceShots = data["tokenBalanceShots"];

        for (let tokenBalanceShot of tokenBalanceShots) {
            let user_address = tokenBalanceShot["user_address"];
            let token_address = tokenBalanceShot["token_address"];
            let token_balance = tokenBalanceShot["token_balance"];
            token_balance = BigInt(token_balance) < 0 ? BigInt(0) : BigInt(token_balance);

            let tokenBalance = balanceMap.get(user_address);
            if (tokenBalance == undefined) {
                let newBalance = new Map<string, string>();
                newBalance.set(token_address, token_balance);
                balanceMap.set(user_address, newBalance);
            } else {
                let balance = tokenBalance.get(token_address);
                if (balance == undefined)
                    tokenBalance.set(token_address, token_balance);
            }
        }
        if (tokenBalanceShots.length < 1000) {
            hasNext = false;
        } else {
            blockNumber = parseInt(data["tokenBalanceShots"][999]["block_number"]);
        }
    }

    return balanceMap;
}

async function getZusdHolders(): Promise<string[]> {
    let hasNext = true;
    let page = 1;
    let lastId = ""
    let holders = [];
    while (hasNext) {
        console.log(`Getting holders page: ${page} ...`);
        let data: any = await graphClient.request(getHolders, {lastId: lastId});
        let result = data["zusdholders"];
        for (let i = 0; i < result.length; i++)
            holders.push(result[i]["id"]);

        if (result.length < 1000)
            hasNext = false;
        else
            lastId = data["zusdholders"][999]["id"];
        page++;
    }
    return holders;
}



export async function getExchangerBalanceMap(blockNumber: number): Promise<Map<string, string>> {

    let usdcBalance = await usdcContract.balanceOf(EXCHANGER, {blockTag: blockNumber});
    let zusdTotal = await zusdContract.totalSupply({blockTag: blockNumber});
    let holders = await getZusdHolders();
    let manager = "0x709b9146219e61dc811f7a469943ada60e013475";
    let managerBalance = await zusdContract.balanceOf(manager, {blockTag: blockNumber});
    zusdTotal = zusdTotal.sub(managerBalance);
    holders = holders.filter((holder) => holder != manager && holder != "0x0000000000000000000000000000000000000000")

    let zusdBalances = await executeInBatches(holders, blockNumber, batchSize);

    const usdcBalanceMap = new Map<string, string>();
    for (let i = 0; i < holders.length; i++){
        try {
            let holder = holders[i];
            let balance = zusdBalances[i];
            let usdcEquivalent = usdcBalance.mul(balance).div(zusdTotal);
            usdcBalanceMap.set(holder, usdcEquivalent.toString());
        } catch (e) {
            console.log("Error", e)
        }
    }
    return usdcBalanceMap;
}

async function getZusdBalance(holder: string, blockNumber: number) {
    return await zusdContract.balanceOf(holder, {blockTag: blockNumber});
}

async function executeInBatches(holders: string[], blockNumber: number, batchSize: number) {
    let results: any = [];

    for (let i = 0; i < holders.length; i += batchSize) {
        console.log(`Processing exchanger balances batch, left: ${holders.length - i} ...`)
        const batch = holders.slice(i, i + batchSize);
        const batchPromises = batch.map(holder => getZusdBalance(holder, blockNumber));
        const batchResults = await Promise.all(batchPromises);
        results = results.concat(batchResults);
    }
    return results;
}