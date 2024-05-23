import * as fs from 'fs';
import {write} from "fast-csv";
import csv from 'csv-parser';
import {ethers} from "ethers";
import {COLLATERAL_ABI, INTERACTION_ABI} from "./sdk/abi";

const fetch = require("node-fetch");

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string;
    usd_price: number;
};

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

const PRIVATE = "0x1bbac7f04cf9a4ce3a011c139af70fafe8921cf4a66d49c6634a04ef2118d0b7";
const LINEA_RPC = "https://rpc.linea.build";
const interactionContract = "0x738F9Ed74a64a01DA9FA3561230eBFa0F309cdC3";

const provider = new ethers.providers.StaticJsonRpcProvider(LINEA_RPC);
// Connect to wallet to sign transactions
const wallet = new ethers.Wallet(PRIVATE, provider);

const interactionC = new ethers.Contract(interactionContract, INTERACTION_ABI, wallet) as any;

const querySize = 1000;
const SUBGRAPH_QUERY_URL = "https://api.goldsky.com/api/public/project_clvqbiycbpgnf01yo9ep9fugr/subgraphs/davos-linea/1.0/gn";
const DEPOSITS_QUERY = `
query Deposits {
  deposits(where: {block_number_lte: $blockNum},first:1000,skip:$skipCount) {
    id
    user
    collateral
  }
}`;

const post = async (url: string, data: any) => {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(data),
    });
    console.log(await response.clone().json())
    return await response.json();
};


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const {blockNumber, blockTimestamp} = blocks
    const csvRows: OutputDataSchemaRow[] = [];
    let skipIndex = 0;
    let usersCollaterals: Record<string, string[]> = {};
    while (true) {
        const responseJson = await post(SUBGRAPH_QUERY_URL, {query: DEPOSITS_QUERY.replace("$skipCount", skipIndex.toString()).replace("$blockNum", blockNumber.toString())});
        let rowCount = 0;
        // @ts-ignore
        for (const item of responseJson.data.deposits) {
            let userAddress = item.user.toString();
            let collateralAddress = item.collateral.toString()
            console.log(userAddress)
            if (usersCollaterals[userAddress]) {
                usersCollaterals[userAddress].push(collateralAddress)
            } else {
                usersCollaterals[userAddress] = [collateralAddress];
            }
            rowCount++;
        }
        skipIndex += rowCount;
        if (rowCount < querySize) {
            break;
        }
    }
    console.log(`Fetched ${skipIndex} records`);
    let latestBalances: Record<string, Record<string, string>> = {};
    for (let user in usersCollaterals) {
        for (let collateral of usersCollaterals[user]) {
            const balance = (await interactionC.locked(collateral, user, {blockTag: blockNumber})).toString();
            const token = (await (new ethers.Contract(collateral, COLLATERAL_ABI, wallet) as any).asset()).toString();
            if (latestBalances[user]) {
                if (!latestBalances[user][token]) {
                    latestBalances[user] = {[token]: balance}
                }
            } else {
                latestBalances[user] = {[token]: balance}
            }
        }
    }

    for (let address in latestBalances) {
        for (let collateral in latestBalances[address]) {
            let value = latestBalances[address][collateral];
            console.log(collateral)
            if (value[0] != "0") {
                csvRows.push({
                    block_number: blockNumber,
                    timestamp: blockTimestamp,
                    user_address: address,
                    token_address: collateral,
                    token_balance: BigInt(value),
                    token_symbol: '',
                    usd_price: 0
                });
            }
        }
    }
    return csvRows;
};

export const main = async (blocks: BlockData[]) => {
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 10; // Size of batch to trigger writing to the file
    let i = 0;

    for (const block of blocks) {
        try {
            // Retrieve data using block number and timestam
            const csvRows = await getUserTVLByBlock(block)

            // Accumulate CSV rows for all blocks
            allCsvRows.push(...csvRows);

            i++;
            console.log(`Processed block ${i}`);

            // Write to file when batch size is reached or at the end of loop
            if (i % batchSize === 0 || i === blocks.length) {
                const ws = fs.createWriteStream(`outputData.csv`, {flags: i === batchSize ? 'w' : 'a'});
                write(allCsvRows, {headers: i === batchSize ? true : false})
                    .pipe(ws)
                    .on("finish", () => {
                        console.log(`CSV file has been written.`);
                    });

                // Clear the accumulated CSV rows
                allCsvRows.length = 0;
            }
        } catch (error) {
            console.error(`An error occurred for block ${block.blockNumber}:`, error);
        }
    }
};


// main([{blockNumber: 4521477, blockTimestamp: 123456}]);


const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
    const blocks: BlockData[] = [];

    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv()) // Specify the separator as '\t' for TSV files
            .on('data', (row) => {
                const blockNumber = parseInt(row.number, 10);
                const blockTimestamp = parseInt(row.timestamp, 10);
                if (!isNaN(blockNumber) && blockTimestamp) {
                    blocks.push({blockNumber: blockNumber, blockTimestamp});
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

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: BlockData[]) => {
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
        const ws = fs.createWriteStream(`outputData.csv`, {flags: 'w'});
        write(allCsvRows, {headers: true})
            .pipe(ws)
            .on("finish", () => {
                console.log(`CSV file has been written.`);
                resolve;
            });
    });
}).catch((err) => {
    console.error('Error reading CSV file:', err);
});
