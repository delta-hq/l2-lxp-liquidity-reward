import fs from 'fs';
import {write} from 'fast-csv';
import csv from 'csv-parser';
import {getBalanceMap, getExchangerBalanceMap} from "./lib/fetcher";
import {assets, USDC} from "./lib/utils";

interface BlockData {
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


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const {blockNumber, blockTimestamp} = blocks
    const csvRows: OutputDataSchemaRow[] = [];

    console.log(`Snapshot for block: ${blockNumber}:`);
    let [balanceMap, exchangerBalanceMap] = await Promise.all([getBalanceMap(blockNumber), getExchangerBalanceMap(blockNumber)]);

    for(let [userAddress, tokenBalance] of exchangerBalanceMap) {
        let tokenBalanceStored = balanceMap.get(userAddress);
        if (tokenBalanceStored == undefined) {
            let newBalance = new Map<string, string>();
            newBalance.set(USDC, tokenBalance);
            balanceMap.set(userAddress, newBalance);
        } else {
            let balance = tokenBalanceStored.get(USDC);
            if (balance == undefined)
                tokenBalanceStored.set(USDC, tokenBalance);
            else
                tokenBalanceStored.set(USDC, (BigInt(balance) + BigInt(tokenBalance)).toString());
        }
    }

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
        const ws = fs.createWriteStream(`outputData.csv`, {flags: 'w'});
        write(allCsvRows, {headers: true})
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
