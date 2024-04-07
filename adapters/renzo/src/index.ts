import * as fs from 'fs';
import { write } from "fast-csv";

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

const querySize = 1000;
const EZ_ETH_ADDRESS = "0x2416092f143378750bb29b79eD961ab195CcEea5";
const TOKEN_SYMBOL = "EZETH";
const SUBGRAPH_QUERY_URL = "https://api.goldsky.com/api/public/project_clsxzkxi8dh7o01zx5kyxdga4/subgraphs/renzo-linea-indexer/v0.1/gn";
const USER_BALANCES_QUERY = `
query BalanceQuery {
    tokenBalances(first: ${querySize}, skip: $skipCount, orderBy: amount, orderDirection: desc) {
        id
        amount
        updatedAtBlockNumber
        updatedAtBlockTimestamp
      }
}
`;

const post = async (url: string, data: any) => {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(data),
    });
    return await response.json();
};


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const { blockNumber, blockTimestamp } = blocks
    const csvRows: OutputDataSchemaRow[] = [];
    let skipIndex = 0;
    while (true) {
        const responseJson = await post(SUBGRAPH_QUERY_URL, { query: USER_BALANCES_QUERY.replace("$skipCount", skipIndex.toString()) });
        let rowCount = 0;
        for (const item of responseJson.data.tokenBalances) {
            if (item.amount != "0") {
                csvRows.push({
                    block_number: blockNumber,
                    timestamp: blockTimestamp,
                    user_address: item.id,
                    token_address: EZ_ETH_ADDRESS,
                    token_balance: item.amount,
                    token_symbol: TOKEN_SYMBOL,
                    usd_price: 0
                });
            }
            rowCount++;
        }
        if (rowCount < querySize) {
            break;
        }
        skipIndex += rowCount;
    }
    console.log(`Processed ${skipIndex} addresses`)
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
                const ws = fs.createWriteStream(`outputData.csv`, { flags: i === batchSize ? 'w' : 'a' });
                write(allCsvRows, { headers: i === batchSize ? true : false })
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
