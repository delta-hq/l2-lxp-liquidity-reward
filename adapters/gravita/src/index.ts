import fs from "fs";
import { write } from "fast-csv";

/**
 * The objective is to quantify:
 *     - TVL on Linea (size of collateral minting GRAI on Linea)
 *     - GRAI stability pool deposits on Linea
 *
 * For that, we'll be querying an existing Gravita Subgraph deployed on TheGraph.
 */

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: number;
    token_symbol: string;
    usd_price: number;
};

const LINEA_RPC = "https://rpc.linea.build";

const GRAI_ADDRESS = "0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487";

const GRAVITA_SUBGRAPH_QUERY_URL = "https://api.studio.thegraph.com/query/54829/gravita-sp-lp-linea-v1/version/latest";

const GRAVITA_STABILITY_POOL_QUERY = `
    query StabilityPoolQuery {
        poolDeposits(first: 1000, where: { poolName: "Gravita StabilityPool", withdrawTxHash: null }) {
            user {
                id
            }
            amountA
        }
    }
`;

const GRAVITA_VESSELS_QUERY = `
    query VesselsQuery {
        vessels(first: 1000, where: { closeTimestamp: null }) {
            asset
            user {
                id
            }
            updates {
                timestamp
                assetAmount
            }
        }
    }
`;

const post = async (url: string, data: any): Promise<any> => {
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

const getLatestBlockNumberAndTimestamp = async () => {
    const data = await post(LINEA_RPC, {
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: ["latest", false],
        id: 1,
    });
    const blockNumber = parseInt(data.result.number);
    const blockTimestamp = parseInt(data.result.timestamp);
    return { blockNumber, blockTimestamp };
};

const getBlockTimestamp = async (number: number): Promise<number> => {
    const hexBlockNumber = "0x" + number.toString(16); // Convert decimal block number to hexadecimal
    console.log(hexBlockNumber)
    const data = await post(LINEA_RPC, {
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: [hexBlockNumber, false],
        id: 1,
    });
    const blockTimestampInt = parseInt(data.result.timestamp);
    console.log(blockTimestampInt)
    return blockTimestampInt;
};


const getStabilityPoolData = async (blockNumber: number, blockTimestamp: number): Promise<OutputDataSchemaRow[]> => {
    const csvRows: OutputDataSchemaRow[] = [];
    const responseJson = await post(GRAVITA_SUBGRAPH_QUERY_URL, { query: GRAVITA_STABILITY_POOL_QUERY });
    for (const item of responseJson.data.poolDeposits) {
        csvRows.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            user_address: item.user.id,
            token_address: GRAI_ADDRESS,
            token_balance: item.amountA,
            token_symbol: "",
            usd_price: 0
        });
    }
    return csvRows;
};

const getVesselDepositsData = async (blockNumber: number, blockTimestamp: number): Promise<OutputDataSchemaRow[]> => {
    const csvRows: OutputDataSchemaRow[] = [];
    const responseJson = await post(GRAVITA_SUBGRAPH_QUERY_URL, { query: GRAVITA_VESSELS_QUERY });
    for (const item of responseJson.data.vessels) {
        const sortedUpdates = item.updates.sort((a: any, b: any) => b.timestamp - a.timestamp);
        const updatedAssetAmount = sortedUpdates[0].assetAmount;
        csvRows.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            user_address: item.user.id,
            token_address: item.asset,
            token_balance: updatedAssetAmount,
            token_symbol: "",
            usd_price: 0
        });
    }
    return csvRows;
};

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

export const main = async (blocks: BlockData[]) => {
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 10; // Size of batch to trigger writing to the file
    let i = 0;

    allCsvRows.push(["block_number", "timestamp", "user_address", "token_address", "token_balance", "token_symbol", "usd_price"]);

    for (const { blockNumber, blockTimestamp } of blocks) {
        try {
            // Retrieve data using block number and timestamp
            const csvRowsStabilityPool = await getStabilityPoolData(blockNumber, blockTimestamp);
            const csvRowsVessels = await getVesselDepositsData(blockNumber, blockTimestamp);
            const csvRows = csvRowsStabilityPool.concat(csvRowsVessels);

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
            console.error(`An error occurred for block ${blockNumber}:`, error);
        }
    }
};


export const getUserTVLByBlock = async (blocks: BlockData) => {
    const { blockNumber, blockTimestamp } = blocks
    //    Retrieve data using block number and timestamp
    const csvRowsStabilityPool = await getStabilityPoolData(blockNumber, blockTimestamp);
    const csvRowsVessels = await getVesselDepositsData(blockNumber, blockTimestamp);
    const csvRows = csvRowsStabilityPool.concat(csvRowsVessels);
    // console.log(csvRows)
    return csvRows
};


const csvData = fs.createReadStream('/home/ramon/Workspace/l2-lxp-liquidity-reward/linea_gravita_hourly_blocks.csv')
csvData.on('data', async (row: BlockData) => {
    // console.log(row)
    await main(row);
    throw new Error("Stop")
});

// main().then(() => {
//     console.log("Done");
//});

// getBlockTimestamp(3041106).then(() => { console.log("done") });