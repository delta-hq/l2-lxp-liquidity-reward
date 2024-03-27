import fs from 'fs';
import {write} from 'fast-csv';
import {gql, GraphQLClient} from "graphql-request";
import {BigNumber, ethers} from "ethers";

const graphClient = new GraphQLClient("https://api.studio.thegraph.com/query/47302/zkdx-graph-linea/v0.0.6")
const lineaProvider = new ethers.providers.JsonRpcProvider("https://rpc.linea.build");

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

export const getUserTVLByBlock = async (block_number: number) => {

    let balanceMap = new Map<string, Map<string, string>>(); // user => token => balance
    let hasNext = true;
    while (hasNext) {
        console.log(`Processing balance snapshots before block: ${block_number} ...`);
        let data: any = await graphClient.request(getBalanceShots, {block_number: block_number});
        let tokenBalanceShots = data["tokenBalanceShots"];

        for (let tokenBalanceShot of tokenBalanceShots) {
            let user_address = tokenBalanceShot["user_address"];
            let token_address = tokenBalanceShot["token_address"];
            let token_balance = tokenBalanceShot["token_balance"];

            let tokenBalance = balanceMap.get(user_address)?.get(token_address);
            if (tokenBalance == undefined) {
                let newBalance = new Map<string, string>();
                newBalance.set(token_address, token_balance);
                balanceMap.set(user_address, newBalance);
            }
        }
        if (tokenBalanceShots.length < 1000) {
            hasNext = false;
        } else {
            block_number = parseInt(data["tokenBalanceShots"][999]["block_number"]);
        }
    }

    return balanceMap;
}

interface Row {
    block_number: string;
    timestamp: string;
    user_address: string;
    token_address: string;
    token_symbol: string;
    token_balance: string;
}

export const SNAPSHOTS_BLOCKS = [
    1140000, 2361808,
];

const getData = async () => {
    const csvRows: Row[] = [];
    for (let block of SNAPSHOTS_BLOCKS) {
        // @ts-ignore
        let timestamp = (await lineaProvider.getBlock(block)).timestamp;
        let timestampStr = new Date(timestamp * 1000).toISOString();
        console.log(`Snapshot for block: ${block}:`);
        let balanceMap = await getUserTVLByBlock(block);

        for (let [user_address, tokenBalances] of balanceMap) {
            for (let [token_address, token_balance] of tokenBalances) {
                if (BigNumber.from(token_balance).lt(100))
                    continue;
                let token_symbol = token_address == "0x176211869ca2b568f2a7d4ee941e073a821ee1ff" ? "USDC" : "WETH";
                let units = token_symbol == "USDC" ? 6 : 18;
                let balance = ethers.BigNumber.from(token_balance);
                csvRows.push({
                    user_address: user_address,
                    token_address: token_address,
                    token_symbol: token_symbol,
                    token_balance: ethers.utils.formatUnits(balance, units),
                    block_number: block.toString(),
                    timestamp: timestampStr
                });
            }
        }
    }

    const ws = fs.createWriteStream('outputData.csv');
    write(csvRows, {headers: true}).pipe(ws).on('finish', () => {
        console.log("CSV file has been written.");
    });
};

getData().then(() => {
    console.log("Done");
});
