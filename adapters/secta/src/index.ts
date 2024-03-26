import BigNumber from "bignumber.js";
import { CHAINS, PROTOCOLS, AMM_TYPES, RPC_URLS } from "./sdk/config";
import {
    getLPValueByUserAndPoolFromPositions,
    getMintedAddresses,
    getPositionAtBlock,
    getPositionDetailsFromPosition,
    getPositionsForAddressByPoolAtBlock,
    getV2Pairs,
} from "./sdk/subgraphDetails";
import {
    LiquidityMap,
    TokenLiquidityInfo,
    LiquidityInfo,
    combineLiquidityInfoMaps,
} from "./sdk/liquidityTypes";

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};
import { promisify } from "util";
import stream from "stream";
import csv from "csv-parser";
import fs from "fs";
import path from "path";
import { format } from "fast-csv";
import { write } from "fast-csv";
import { pipeline as streamPipeline } from "stream";
import { captureRejectionSymbol } from "events";
import { getV2LpValue } from "./sdk/poolDetails";


interface LPValueDetails {
    pool: string;
    lpValue: string;
}

interface UserLPData {
    totalLP: string;
    pools: LPValueDetails[];
}

// Define an object type that can be indexed with string keys, where each key points to a UserLPData object
interface OutputData {
    [key: string]: UserLPData;
}

const pipeline = promisify(stream.pipeline);

interface BlockData {
    blockNumber: number;
    blockTimestamp: number;
}

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
    const blocks: BlockData[] = [];
    //console.log(`Reading: ${filePath}`);

    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv({ separator: "\t" })) // Specify the separator as '\t' for TSV files
            .on("data", (row) => {
                //console.log(row);
                const blockNumber = parseInt(row.number, 10);
                const blockTimestamp = parseInt(row.block_timestamp, 10);
                //console.log(`Maybe Data ${blockNumber} ${blockTimestamp}`);
                if (!isNaN(blockNumber) && blockTimestamp) {
                    //console.log(`Valid Data`);
                    blocks.push({ blockNumber: blockNumber, blockTimestamp });
                }
            })
            .on("end", () => {
                resolve();
            })
            .on("error", (err) => {
                reject(err);
            });
    });

    //console.log(`blocks: ${blocks.length}`);
    return blocks;
};

type OutputDataSchemaRow = {
    block_number: number;
    timestamp: number;
    user_address: string;
    token_address: string;
    token_balance: bigint;
    token_symbol: string;
    usd_price: number;
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
    const { blockNumber, blockTimestamp } = blocks;
    //console.log(`Getting tvl in block: ${blockNumber}`);

    const v3Positions = await getPositionsForAddressByPoolAtBlock(
        blockNumber,
        "",
        "",
        CHAINS.LINEA,
        PROTOCOLS.SECTA,
        AMM_TYPES.SECTAV3
    );
    let v3PositionsWithValue = v3Positions.map(getPositionDetailsFromPosition);
    let v3LpValue = getLPValueByUserAndPoolFromPositions(v3PositionsWithValue);

    let pairs = await getV2Pairs(
        blockNumber,
        CHAINS.LINEA,
        PROTOCOLS.SECTA,
        AMM_TYPES.SECTAV2
    );
    let mintedAddresses = await getMintedAddresses(
        blockNumber,
        CHAINS.LINEA,
        PROTOCOLS.SECTA,
        AMM_TYPES.SECTAV2
    );

    let v2LpValue = await getV2LpValue(
        RPC_URLS[CHAINS.LINEA],
        pairs,
        mintedAddresses,
        blockNumber
    );

    const combinedLpValue = combineLiquidityInfoMaps(v3LpValue, v2LpValue);

    let csvRows: OutputDataSchemaRow[] = [];

    Object.entries(combinedLpValue).forEach(([userAddress, tokens]) => {
        Object.entries(tokens).forEach(([token, { amount, decimals }]) => {
            csvRows.push({
                block_number: blockNumber,
                timestamp: blockTimestamp,
                user_address: userAddress,
                token_address: token,
                token_balance: BigInt(
                    BigNumber(amount)
                        .times(BigNumber(10 ** decimals))
                        .integerValue()
                        .toNumber()
                ),
                token_symbol: "",
                usd_price: 0,
            });
        });
    });

    return csvRows;
};

/*readBlocksFromCSV(path.resolve(__dirname, "../block_numbers_secta.tsv"))
    .then(async (blocks) => {
        console.log(blocks);
        const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
        const batchSize = 10; // Size of batch to trigger writing to the file
        let i = 0;

        for (const block of blocks) {
            try {
                const result = await getUserTVLByBlock(block);

                // Accumulate CSV rows for all blocks
                allCsvRows.push(...result);

                i++;
                console.log(`Processed block ${i}`);

                // Write to file when batch size is reached or at the end of loop
                if (i % batchSize === 0 || i === blocks.length) {
                    const ws = fs.createWriteStream(`outputData.csv`, {
                        flags: i === batchSize ? "w" : "a",
                    });
                    write(allCsvRows, {
                        headers: i === batchSize ? true : false,
                    })
                        .pipe(ws)
                        .on("finish", () => {
                            console.log(`CSV file has been written.`);
                        });

                    // Clear the accumulated CSV rows
                    allCsvRows.length = 0;
                }
            } catch (error) {
                console.error(`An error occurred for block ${block}:`, error);
            }
        }
    })
    .catch((err) => {
        console.error("Error reading CSV file:", err);
    });*/

// main().then(() => {
//   console.log("Done");
// });
// getPrice(new BigNumber('1579427897588720602142863095414958'), 6, 18); //Uniswap
// getPrice(new BigNumber('3968729022398277600000000'), 18, 6); //PROTOCOL_NAME
