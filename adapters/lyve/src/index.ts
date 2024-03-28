import * as fs from "fs";
import { write } from "fast-csv";


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
const LYU_ADDRESS = "0xb20116eE399f15647BB1eEf9A74f6ef3b58bc951";

const LYVE_SUBGRAPH_QUERY_URL = "https://api.studio.thegraph.com/query/53783/lyve-lp-tvl/version/latest";

const LYVE_STABILITY_POOL_QUERY = `
    query StabilityPoolQuery {
        userDeposits(first: 1000,orderBy: _newDeposit, orderDirection: desc) {
            _depositor,
            _newDeposit
        }
    }
`;

const _VESSELS_QUERY = `
    query VesselQuery {
        vessels(first: 1000,where: { _status: 0 }) {
        id
        _borrower
        _asset
        updates {
        _coll
        blockTimestamp
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

const getStabilityPoolData = async (blockNumber: number, blockTimestamp: number): Promise<OutputDataSchemaRow[]> => {
    const csvRows: OutputDataSchemaRow[] = [];
    const responseJson = await post(LYVE_SUBGRAPH_QUERY_URL, { query: LYVE_STABILITY_POOL_QUERY });
    for (const item of responseJson.data.userDeposits) {
        csvRows.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            user_address: item._depositor,
            token_address: LYU_ADDRESS,
            token_balance: item._newDeposit,
            token_symbol: "LYU",
            usd_price: 0
        });
    }
    return csvRows;
};
const getVesselDepositsData = async (blockNumber: number, blockTimestamp: number): Promise<OutputDataSchemaRow[]> => {
    const csvRows: OutputDataSchemaRow[] = [];
    const responseJson = await post(LYVE_SUBGRAPH_QUERY_URL, { query: _VESSELS_QUERY });
    for (const item of responseJson.data.vessels) {
        const sortedUpdates = item.updates.sort((a: any, b: any) => b.blockTimestamp - a.blockTimestamp);
        const updatedAssetAmount = sortedUpdates[0]._coll;
        csvRows.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            user_address: item._borrower,
            token_address: item._asset,
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
    return csvRows
};