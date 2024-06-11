import * as fs from 'fs';
import {write} from "fast-csv";
import csv from 'csv-parser';
import {ethers} from "ethers";
import {INCEPTION_TOKEN_ABI, RATIO_ABI, STRATEGY_ABI, VAULT_ABI} from "./sdk/abi";

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
const ETH_RPC = "https://eth.llamarpc.com";
const RATIO_FEED = "0x048a2F5CD64B89f750cf14a5F36922Ae7b07221c";


const lineaProvider = new ethers.providers.StaticJsonRpcProvider(LINEA_RPC);
const ethProvider = new ethers.providers.StaticJsonRpcProvider(ETH_RPC);
// Connect to wallet to sign transactions
const lineaWallet = new ethers.Wallet(PRIVATE, lineaProvider);
const ethWallet = new ethers.Wallet(PRIVATE, ethProvider);
const querySize = 1000;
const queryCollateral: Record<string, string[]> = {
    "0x7FA768E035F956c41d6aeaa3Bd857e7E5141CAd5": ["https://api.goldsky.com/api/public/project_clx37oapi635v01tw7ccd0b61/subgraphs/inception-insteth-linea-linea/1.0/gn", `
query Transfers {
  transfers(where: {block_number_lte: $blockNum},first:1000,skip:$skipCount) {
    id
    from
    to
  }
}`, "0xd08C3F25862077056cb1b710937576Af899a4959"],
    "0xf073bac22dab7faf4a3dd6c6189a70d54110525c": ["https://api.goldsky.com/api/public/project_clx37oapi635v01tw7ccd0b61/subgraphs/inception-ineth-linea-linea/1.0/gn", `
query Transfers {
  transfers(where: {block_number_lte: $blockNum},first:1000,skip:$skipCount) {
    id
    from
    to
  }
}`, "0x5A7a183B6B44Dc4EC2E3d2eF43F98C5152b1d76d"]
}

let vaults: Record<string, string> = {"0xf073bac22dab7faf4a3dd6c6189a70d54110525c": "0x5A7a183B6B44Dc4EC2E3d2eF43F98C5152b1d76d"}
let collaterals: Record<string, string> = {"0xf073bac22dab7faf4a3dd6c6189a70d54110525c": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"}

const post = async (url: string, data: any) => {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(data),
        });

        return await response.json();
    } catch (error) {
        console.error("Error:", error);
    }
};

function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const getUserTVLByBlock = async (blocks: BlockData) => {
    const {blockNumber, blockTimestamp} = blocks
    const csvRows: OutputDataSchemaRow[] = [];
    let skipIndex = 0;
    let latestBalances: Record<string, Record<string, string>> = {};
    for (let collateral in queryCollateral) {
        let usersCollaterals: Record<string, string[]> = {};

        while (true) {
            await sleep(1000);
            const responseJson = await post(queryCollateral[collateral][0], {query: queryCollateral[collateral][1].replace("$skipCount", skipIndex.toString()).replace("$blockNum", blockNumber.toString())});
            let rowCount = 0;
            // @ts-ignore
            for (const item of responseJson.data.transfers) {
                let userAddress = item.to.toString();
                if (!usersCollaterals[userAddress]) {
                    usersCollaterals[userAddress] = [collateral, queryCollateral[collateral][2]];
                }
                rowCount++;
            }
            skipIndex += rowCount;
            if (rowCount < querySize) {
                break;
            }
        }

        let ratioCache: Record<string, string> = {}
        for (let user in usersCollaterals) {
            if (user == "0x0000000000000000000000000000000000000000") {
                continue;
            }
            await sleep(100);
            const shares = (await (new ethers.Contract(usersCollaterals[user][1], INCEPTION_TOKEN_ABI, lineaWallet) as any).balanceOf(user, {blockTag: blockNumber})).toString();
            if (!shares) {
                continue
            }

            let vault = vaults[usersCollaterals[user][0]];
            if (!vault) {
                vault = (await (new ethers.Contract(usersCollaterals[user][0], INCEPTION_TOKEN_ABI, ethWallet) as any).vault()).toString();
                vaults[usersCollaterals[user][0]] = vault;
            } else {
                console.log("cached vault")
            }
            let collateral = collaterals[usersCollaterals[user][0]]

            if (!collateral) {
                const strategy = (await (new ethers.Contract(vault, VAULT_ABI, ethWallet) as any).strategy()).toString();
                collateral = (await (new ethers.Contract(strategy, STRATEGY_ABI, ethWallet) as any).underlyingToken()).toString();
                collaterals[usersCollaterals[user][0]] = collateral;
            } else {
                console.log("cached collateral")
            }

            let ratio = ratioCache[vault]
            if (!ratio) {
                ratio = (await (new ethers.Contract(RATIO_FEED, RATIO_ABI, lineaWallet) as any).getRatioFor(vault, {blockTag: blockNumber})).toString();
                ratioCache[vault] = ratio;
            } else {
                console.log("cached ratio")
            }

            const balance = (BigInt(shares) * BigInt(1000000000000000000) / BigInt(ratio)).toString();

            if (latestBalances[user]) {
                if (!latestBalances[user][collateral]) {
                    latestBalances[user][collateral] = balance
                }
            } else {
                latestBalances[user] = {[collateral]: balance}
            }
        }
        skipIndex = 0;
    }

    for (let address in latestBalances) {
        for (let collateral in latestBalances[address]) {
            let value = latestBalances[address][collateral];
            if (value[0] != "0") {
                csvRows.push({
                    block_number: blockNumber,
                    timestamp: blockTimestamp,
                    user_address: address.toLowerCase(),
                    token_address: collateral.toLowerCase(),
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


// main([{blockNumber: 5251934, blockTimestamp: 123456}]);


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
            console.error(`An error  occurred for block ${block}:`, error);
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
