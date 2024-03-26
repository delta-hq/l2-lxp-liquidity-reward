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

//Uncomment the following lines to test the getPositionAtBlock function

// const position = getPositionAtBlock(
//         0, // block number 0 for latest block
//         2, // position id
//         CHAINS.L2_CHAIN_ID, // chain id
//         PROTOCOLS.PROTOCOL_NAME, // protocol
//         AMM_TYPES.UNISWAPV3 // amm type
//     );
// position.then((position) => {
//     // print response
//     const result = getPositionDetailsFromPosition(position);
//     console.log(`${JSON.stringify(result,null, 4)}
//     `)
// });

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

interface CSVRow {
    user: string;
    pool: string;
    block: number;
    position: number;
    lpvalue: string;
}

const pipeline = promisify(stream.pipeline);

// Assuming you have the following functions and constants already defined
// getPositionsForAddressByPoolAtBlock, CHAINS, PROTOCOLS, AMM_TYPES, getPositionDetailsFromPosition, getLPValueByUserAndPoolFromPositions, BigNumber

// const readBlocksFromCSV = async (filePath: string): Promise<number[]> => {
//   const blocks: number[] = [];
//   await pipeline(
//     fs.createReadStream(filePath),
//     csv(),
//     async function* (source) {
//       for await (const chunk of source) {
//         // Assuming each row in the CSV has a column 'block' with the block number
//         if (chunk.block) blocks.push(parseInt(chunk.block, 10));
//       }
//     }
//   );
//   return blocks;
// };

// const getData = async () => {
//   const snapshotBlocks = [
//     3116208, 3159408, 3202608, 3245808, 3289008, 3332208,
//     3375408, 3418608, 3461808, 3505008, 3548208, 3591408,
//     3634608, 3677808, 3721008, 3764208, 3807408, 3850608,
//     3893808, 3937008, 3980208, 3983003,
//   ]; //await readBlocksFromCSV('src/sdk/L2_CHAIN_ID_chain_daily_blocks.csv');

//   const csvRows: CSVRow[] = [];

//   for (let block of snapshotBlocks) {
//     const positions = await getPositionsForAddressByPoolAtBlock(
//       block, "", "", CHAINS.L2_CHAIN_ID, PROTOCOLS.PROTOCOL_NAME, AMM_TYPES.UNISWAPV3
//     );

//     console.log(`Block: ${block}`);
//     console.log("Positions: ", positions.length);

//     // Assuming this part of the logic remains the same
//     let positionsWithUSDValue = positions.map(getPositionDetailsFromPosition);
//     let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positionsWithUSDValue);

//     lpValueByUsers.forEach((value, key) => {
//       let positionIndex = 0; // Define how you track position index
//       value.forEach((lpValue, poolKey) => {
//         const lpValueStr = lpValue.toString();
//         // Accumulate CSV row data
//         csvRows.push({
//           user: key,
//           pool: poolKey,
//           block,
//           position: positions.length, // Adjust if you have a specific way to identify positions
//           lpvalue: lpValueStr,
//         });
//       });
//     });
//   }

//   // Write the CSV output to a file
//   const ws = fs.createWriteStream('outputData.csv');
//   write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
//     console.log("CSV file has been written.");
//   });
// };

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
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
    const { blockNumber, blockTimestamp } = blocks;
    //console.log(`Getting tvl in block: ${blockNumber}`);

    const v3Positions = await getPositionsForAddressByPoolAtBlock(
        blockNumber,
        "",
        "",
        CHAINS.LINEA_ID,
        PROTOCOLS.SECTA,
        AMM_TYPES.SECTAV3
    );
    let v3PositionsWithValue = v3Positions.map(getPositionDetailsFromPosition);
    let v3LpValue = getLPValueByUserAndPoolFromPositions(v3PositionsWithValue);

    let pairs = await getV2Pairs(
        blockNumber,
        CHAINS.LINEA_ID,
        PROTOCOLS.SECTA,
        AMM_TYPES.SECTAV2
    );
    let mintedAddresses = await getMintedAddresses(
        blockNumber,
        CHAINS.LINEA_ID,
        PROTOCOLS.SECTA,
        AMM_TYPES.SECTAV2
    );

    let v2LpValue = await getV2LpValue(
        RPC_URLS[CHAINS.LINEA_ID],
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
            });
        });
    });

    return csvRows;
};

/*readBlocksFromCSV(
    path.resolve(__dirname, "../../block_numbers.tsv")
)
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
