import csv from 'csv-parser';
import {write} from "fast-csv";
import fs from "fs";
import _ from 'lodash';

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export interface GQLResp {
    data: Data;
}

export interface Data {
    boughtRiskyDebtVaults: BoughtRiskyDebtVault[];
    liquidateVaults: {vaultInfo: VaultInfo}[];
    payBackTokens: PayBackToken[];
    borrowTokens: BorrowToken[];
}

interface BoughtRiskyDebtVault {
    timestamp: string;
    blockNumber: string;
    riskyVault: VaultInfo;
    riskyVaultBuyer: string;
    amountPaidtoBuy: string;
    newVault: VaultInfo;
}

export interface BorrowToken {
    blockNumber: string;
    vaultInfo: VaultInfo;
}

export interface VaultInfo {
    id: string;
    owner: string;
    debt: string;
}

export interface PayBackToken {
    blockNumber: string;
    id: string;
    vaultInfo: VaultInfo;
}

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string;
    usd_price: number;
};


const SUBGRAPH_QUERY_URL =
    "https://api.goldsky.com/api/public/project_clwvughgzvxku01xigwdkgqw5/subgraphs/qidao-linea/1.3/gn";

const PAGE_SIZE = 1_000

const MAI_ADDRESS = "0xf3B001D64C656e30a62fbaacA003B1336b4ce12A"

const post = async <T>(url: string, data: any): Promise<T> => {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(data),
    });
    return await response.json();
}

function isBoughtRiskyDebtVault(arg: BoughtRiskyDebtVault | {vaultInfo: VaultInfo}): arg is BoughtRiskyDebtVault {
    return "riskyVault" in arg;
}

const getBorrowRepaidData = async (
    blockNumber: number,
    blockTimestamp: number,
    lastId = ''
): Promise<OutputDataSchemaRow[]> => {
    const BORROW_PAYBACK_QUERY = `
{
  boughtRiskyDebtVaults(
    orderBy: blockNumber, 
    orderDirection: desc,
    where: {id_gt: "${lastId}"},
    block: {number: ${blockNumber}}
  ) {
    timestamp
    blockNumber
    riskyVault {
      id
      owner
      debt
    }
    newVault {
      id
      owner
      debt
    }
  }
  liquidateVaults(
    orderBy: blockNumber, 
    orderDirection: asc,
    where: {id_gt: "${lastId}"},
    block: {number: ${blockNumber}}
  ) {
    __typename
    blockNumber
    debtRepaid
    vaultInfo {
      owner
      id
      debt
    }
  }
  payBackTokens(
    orderBy: blockNumber, 
    orderDirection: asc,
    where: {id_gt: "${lastId}"},
    block: {number: ${blockNumber}}
  ) {
    __typename
    blockNumber
    id
    amount
    vaultInfo {
      id
      owner
      debt
    }
  }
  borrowTokens(
    orderBy: blockNumber, 
    orderDirection: asc,
    where: {id_gt: "${lastId}"},
    block: {number: ${blockNumber}}
  ) {
    __typename
    blockNumber
    amount
    vaultInfo {
      id
      owner
      debt
    }
  }
}`;
    const csvRows: OutputDataSchemaRow[] = [];
    const responseJson = await post<GQLResp>(SUBGRAPH_QUERY_URL, {
        query: BORROW_PAYBACK_QUERY,
    });
    const k = 'borrowTokens'
    if (!responseJson.data) {
        console.error('No data found for block:', blockNumber)
    } else {
        const {liquidateVaults, borrowTokens, payBackTokens} = responseJson.data
        const grpedBorrows = _.groupBy(borrowTokens, 'vaultInfo.owner')
        const grpedLiquidates = _.groupBy(liquidateVaults, 'vaultInfo.owner')
        const grpedPaybacks = _.groupBy(payBackTokens, 'vaultInfo.owner')
        const riskyVaultsByOwner = _.groupBy(responseJson.data.boughtRiskyDebtVaults, 'riskyVault.owner')
        const newRiskyVaultsByOwner = _.groupBy(responseJson.data.boughtRiskyDebtVaults, 'newVault.owner')
        const merged = _.merge(grpedBorrows, grpedLiquidates, grpedPaybacks, riskyVaultsByOwner, newRiskyVaultsByOwner)
        // const sorted = _.orderBy(merged, 'blockNumber', 'asc')
        console.dir(merged, {depth: null})
        const vInfo: ({vaultInfo: VaultInfo} | BoughtRiskyDebtVault)[] = Object.values(merged).flatMap( (e) => {
            const res = _.maxBy(e, 'blockNumber')
            return res ? [res] : []
        })

        const vaultToCsvRow = (vault: VaultInfo) => {
            return {
                block_number: blockNumber,
                timestamp: blockTimestamp,
                user_address: vault.owner,
                token_address: MAI_ADDRESS,
                token_balance: BigInt(vault.debt),
                token_symbol: "MAI",
                usd_price: 0,
            };
        }
        for (const item of vInfo) {
            if(isBoughtRiskyDebtVault(item)) {
                csvRows.push(vaultToCsvRow(item.newVault), vaultToCsvRow(item.riskyVault))
            } else {
                csvRows.push(vaultToCsvRow(item.vaultInfo));
            }
        }
        if (responseJson.data.borrowTokens.length == PAGE_SIZE ||
            responseJson.data.liquidateVaults.length == PAGE_SIZE ||
            responseJson.data.payBackTokens.length == PAGE_SIZE) {
            const lastRecord = responseJson.data[k][responseJson.data[k].length - 1] as any
            csvRows.push(...await getBorrowRepaidData(blockNumber, blockTimestamp, lastRecord.id))
        }
    }
    return csvRows;
};

export const main = async (blocks: BlockData[]) => {
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 10; // Size of batch to trigger writing to the file
    let i = 0;

    for (const {blockNumber, blockTimestamp} of blocks) {
        try {
            // Retrieve data using block number and timestamp
            const csvRows = await getBorrowRepaidData(
                blockNumber,
                blockTimestamp
            );

            // Accumulate CSV rows for all blocks
            allCsvRows.concat(csvRows);

            i++;
            console.log(`Processed block ${i}`);

            // Write to file when batch size is reached or at the end of loop
            if (i % batchSize === 0 || i === blocks.length) {
                const ws = fs.createWriteStream(`outputData.csv`, {
                    flags: i === batchSize ? "w" : "a",
                });
                write(allCsvRows, {headers: i === batchSize})
                    .pipe(ws)
                    .on("finish", () => {
                        console.log(`CSV file has been written.`);
                    });

                // Clear the accumulated CSV rows
                allCsvRows.length = 0;
            }
        } catch (error) {
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
    const {blockNumber, blockTimestamp} = blocks;
    //    Retrieve data using block number and timestamp
    return await getBorrowRepaidData(
        blockNumber,
        blockTimestamp
    );
};

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

readBlocksFromCSV('./hourly_blocks.csv').then(async (blocks: any[]) => {
    // console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);
            allCsvRows.push(...result);
        } catch (error) {
            console.error(`An error occurred for block ${block}:`, error);
        }
    }
    await new Promise((resolve) => {
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
