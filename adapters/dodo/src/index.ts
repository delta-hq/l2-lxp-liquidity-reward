import { AMM_TYPES, CHAINS, PROTOCOLS } from "./sdk/config";
import {
  getLPValueByUserAndPoolFromPositions,
  getPositionDetailsFromPosition,
  getPositionsForAddressByPoolAtBlock,
  getTokenPriceFromPositions,
} from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import csv from "csv-parser";
import { write } from "fast-csv";
import fs from "fs";
import stream from "stream";
import { promisify } from "util";

//Uncomment the following lines to test the getPositionAtBlock function

// const position = getPositionAtBlock(
//         0, // block number 0 for latest block
//         2, // position id
//         CHAINS.MODE, // chain id
//         PROTOCOLS.SUPSWAP, // protocol
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

const readBlocksFromCSV = async (filePath: string): Promise<number[]> => {
  const blocks: number[] = [];
  await pipeline(
    fs.createReadStream(filePath),
    csv(),
    async function* (source) {
      for await (const chunk of source) {
        // Assuming each row in the CSV has a column 'block' with the block number
        if (chunk.block) blocks.push(parseInt(chunk.block, 10));
      }
    }
  );
  return blocks;
};

const getData = async () => {
  const snapshotBlocks = [2862898, 2892898]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');

  const csvRows: CSVRow[] = [];

  for (let block of snapshotBlocks) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block,
      "",
      "",
      CHAINS.LINEA,
      PROTOCOLS.DODOEX,
      AMM_TYPES.DODO
    );

    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    // Assuming this part of the logic remains the same
    let positionsWithUSDValue = [];
    // Add price to token
    await getTokenPriceFromPositions(positions, "linea");
    for (let position of positions) {
      const res = await getPositionDetailsFromPosition(position);
      positionsWithUSDValue.push(res);
    }
    let lpValueByUsers = await getLPValueByUserAndPoolFromPositions(
      positionsWithUSDValue
    );

    lpValueByUsers.forEach((value, key) => {
      let positionIndex = 0; // Define how you track position index
      value.forEach((lpValue, poolKey) => {
        const lpValueStr = lpValue.toString();
        // Accumulate CSV row data
        csvRows.push({
          user: key,
          pool: poolKey,
          block,
          position: positions.length, // Adjust if you have a specific way to identify positions
          lpvalue: lpValueStr,
        });
      });
    });
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });
};

getData().then(() => {
  console.log("Done");
});
