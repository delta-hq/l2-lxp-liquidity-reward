import fs from 'fs';
import {write} from 'fast-csv';
import {gql, GraphQLClient} from "graphql-request";
import csv from 'csv-parser';

export interface BlockData {
    blockTimestamp: number;
    blockNumber: number
}

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string; // token symbol should be empty string if it is not available
    usd_price: number; // assign 0 if not available
};

const assets: { [key: string]: string } = {
    "0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "USDC",
    "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f": "WETH",
};

const graphClient = new GraphQLClient("https://api.studio.thegraph.com/query/47302/zkdx-graph-linea/v0.0.6")
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


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const {blockNumber, blockTimestamp} = blocks
    const csvRows: OutputDataSchemaRow[] = [];

    console.log(`Snapshot for block: ${blockNumber}:`);
    let balanceMap = await getBalanceMap(blockNumber);
    for (let [user_address, tokenBalances] of balanceMap) {
        for (let [token_address, token_balance] of tokenBalances) {
            let balance = BigInt(token_balance);
            if (balance == BigInt(0))
                continue;
            csvRows.push({
                block_number: blockNumber,
                timestamp: blockTimestamp,
                user_address: user_address,
                token_address: token_address,
                token_balance: BigInt(token_balance),
                token_symbol: assets[token_address] ?? "",
                usd_price: 0
            });
        }
    }

    return csvRows;
}

export const getBalanceMap = async (blockNumber: number) => {
    let balanceMap = new Map<string, Map<string, string>>(); // user => token => balance
    let hasNext = true;
    while (hasNext) {
        console.log(`Processing balance snapshots before block: ${blockNumber} ...`);
        let data: any = await graphClient.request(getBalanceShots, {block_number: blockNumber});
        let tokenBalanceShots = data["tokenBalanceShots"];

        for (let tokenBalanceShot of tokenBalanceShots) {
            let user_address = tokenBalanceShot["user_address"];
            let token_address = tokenBalanceShot["token_address"];
            let token_balance = tokenBalanceShot["token_balance"];

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

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
    const blocks: BlockData[] = [];

    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv()) // Specify the separator as '\t' for TSV files
            .on('data', (row) => {
                const blockNumber = parseInt(row.number, 10);
                const blockTimestamp = parseInt(row.timestamp, 10);
                if (!isNaN(blockNumber) && blockTimestamp) {
                    blocks.push({ blockNumber: blockNumber, blockTimestamp });
                }
            })
            .on('end', () => {
                resolve();
            })
            .on('error', (err) => {
                reject(err);
            });
    });

    return blocks;
};

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 1000; // Size of batch to trigger writing to the file
    let i = 0;

    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);
            allCsvRows.push(...result);
        } catch (error) {
            console.error(`An error occurred for block ${block}:`, error);
        }
    }
    await new Promise((resolve, reject) => {
        // const randomTime = Math.random() * 1000;
        // setTimeout(resolve, randomTime);
        const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
        write(allCsvRows, { headers: true })
            .pipe(ws)
            .on("finish", () => {
                console.log(`CSV file has been written.`);
                resolve;
            });
    });

    // Clear the accumulated CSV rows
    // allCsvRows.length = 0;

}).catch((err) => {
    console.error('Error reading CSV file:', err);
});