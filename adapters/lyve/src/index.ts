import fs from "fs";
import { write } from "fast-csv";


type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
};

const LINEA_RPC = "https://rpc.linea.build";

const LYVE_SUBGRAPH_QUERY_URL = "https://api.studio.thegraph.com/query/53783/lyve-lp-tvl/version/latest";

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


const getVesselDepositsData = async (blockNumber: number, blockTimestamp: number): Promise<OutputDataSchemaRow[]> => {
    const csvRows: OutputDataSchemaRow[] = [];
    const responseJson = await post(LYVE_SUBGRAPH_QUERY_URL, { query: _VESSELS_QUERY });
    for (const item of responseJson.data.vessels) {
        const sortedUpdates = item.updates.sort((a: any, b: any) => b.blockTimestamp - a.blockTimestamp);
        const updatedAssetAmount = sortedUpdates[0]._coll;
        csvRows.push({
            block_number: blockNumber,
            timestamp: blockTimestamp,
            token_address: item._asset,
            token_balance: updatedAssetAmount,
            user_address: item._borrower,
        });
    }
    return csvRows;
};

const main = async () => {
    const { blockNumber, blockTimestamp } = await getLatestBlockNumberAndTimestamp();
    const csvRowsVessels = await getVesselDepositsData(blockNumber, blockTimestamp);
    // Write the CSV output to a file
    const ws = fs.createWriteStream("outputData.csv");
    write(csvRowsVessels, { headers: true })
        .pipe(ws)
        .on("finish", () => {
            console.log("CSV file has been written.");
        });
};

main().then(() => {
    console.log("Done");
});
