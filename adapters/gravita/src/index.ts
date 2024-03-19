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
    token_balance: bigint;
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

const getStabilityPoolData = async (blockNumber: number, blockTimestamp: number): Promise<OutputDataSchemaRow[]> => {
    const csvRows: OutputDataSchemaRow[] = [];
    const responseJson = await post(GRAVITA_SUBGRAPH_QUERY_URL, { query: GRAVITA_STABILITY_POOL_QUERY });
    for (const item of responseJson.data.poolDeposits) {
        csvRows.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            token_address: GRAI_ADDRESS,
            token_balance: item.amountA,
            user_address: item.user.id,
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
            token_address: item.asset,
            token_balance: updatedAssetAmount,
            user_address: item.user.id,
        });
    }
    return csvRows;
};

const main = async () => {
    const { blockNumber, blockTimestamp } = await getLatestBlockNumberAndTimestamp();
    const csvRowsStabilityPool = await getStabilityPoolData(blockNumber, blockTimestamp);
    const csvRowsVessels = await getVesselDepositsData(blockNumber, blockTimestamp);
    const csvRows = csvRowsStabilityPool.concat(csvRowsVessels);
    // Write the CSV output to a file
    const ws = fs.createWriteStream("outputData.csv");
    write(csvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
            console.log("CSV file has been written.");
        });
};

main().then(() => {
    console.log("Done");
});
