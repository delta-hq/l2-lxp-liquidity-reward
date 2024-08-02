import {client} from "./utils/client";
import {farmPid, stablecoinFarmAddress, vaultsAddresses, zeroAddress} from "./utils/constants";
import fs from "fs";
import {write} from "fast-csv";
import csv from 'csv-parser';
import {erc20Abi} from "viem";
import {farmAbi} from "./utils/abis";

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string; //token symbol should be empty string if it is not available
    usd_price: number; //assign 0 if not available
};

type UserInfo = {
    result: [bigint, bigint, bigint]
}

type BalanceOf = {
    result: bigint
}

let holdersRetrieved = false;
const holders: Set<`0x${string}`> = new Set();

const getAllHolders = async (block: number) => {
    if (!holdersRetrieved) {
        for (const vault of vaultsAddresses) {
            const logs = await client.getContractEvents({
                address: vault.address,
                abi: erc20Abi,
                eventName: "Transfer",
                fromBlock: vault.start_block,
                toBlock: BigInt(block),
            });

            logs.forEach((log) => {
                if (log.args.from && ![stablecoinFarmAddress, zeroAddress].includes(log.args.from))
                    holders.add(log.args.from);
                if (log.args.to && ![stablecoinFarmAddress, zeroAddress].includes(log.args.to))
                    holders.add(log.args.to);
            });
        }

        holdersRetrieved = true;
    }

    return holders;
}

export const getUserTVLByBlock = async (
    blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
    const {blockNumber, blockTimestamp} = blocks
    const allCsvRows: OutputDataSchemaRow[] = [];

    const holders = await getAllHolders(blockNumber);

    for (let i = 0; i < vaultsAddresses.length; i++) {
        const {address, underlying_symbol, underlying} = vaultsAddresses[i];
        const balanceReads: any[] = [];
        const farmReads: any[] = [];

        holders.forEach((holder) => {
            balanceReads.push({
                abi: erc20Abi,
                functionName: "balanceOf",
                address: address,
                args: [holder],
                blockNumber,
            });
            farmReads.push({
                abi: farmAbi,
                functionName: "userInfo",
                address: stablecoinFarmAddress,
                args: [farmPid[address], holder],
                blockNumber,

            })
        });

        const balances: BalanceOf[] = await client.multicall({contracts: balanceReads}) as BalanceOf[];
        const usersInfo: UserInfo[] = await client.multicall({contracts: farmReads}) as UserInfo[];

        for (let j = 0; j < Array.from(holders).length; j++) {
            const farmBalance = usersInfo[j].result[0];
            const userBalance = balances[j].result;

            if (balances[j].result || farmBalance)
                allCsvRows.push({
                    block_number: blockNumber,
                    timestamp: blockTimestamp,
                    user_address: Array.from(holders)[j].toLowerCase(),
                    token_address: underlying.toLowerCase(),
                    token_symbol: underlying_symbol,
                    token_balance: userBalance + farmBalance,
                    usd_price: 0,
                });
        }
    }

    return allCsvRows
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
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);

            allCsvRows.push(...result)
        } catch (error) {
            console.error(`An error occurred for block ${block}:`, error);
        }
    }

    await new Promise((resolve) => {
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
