import fs from "fs";
import csv from "csv-parser";
import path from "path";

import { BlockData } from "./sdk/types";
import { PositionsStream } from "./sdk/lib";
import {
  POSITIONS_V1_SUBGRAPH_URL,
  POSITIONS_V2_SUBGRAPH_URL,
} from "./sdk/config";

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: "," }))
      .on("data", (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.timestamp, 10);

        if (!isNaN(blockNumber) && blockTimestamp) {
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

  return blocks;
};

readBlocksFromCSV(path.resolve(__dirname, "../hourly_blocks.csv"))
  .then(async (blocks) => {
    const streams = blocks.flatMap((block) => [
      new PositionsStream(block, POSITIONS_V1_SUBGRAPH_URL),
      // new PositionsStream(block, POSITIONS_V2_SUBGRAPH_URL),
    ]);

    mergeStreams(streams);
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });

function mergeStreams(positionStreams: PositionsStream[]) {
  const csvWriteStream = fs.createWriteStream(`outputData.csv`, {
    flags: "w",
  });

  csvWriteStream.write(
    "block_number,timestamp,user_address,token_address,token_balance,token_symbol,usd_price\n"
  );

  let completedReads = 0;

  for (const source of positionStreams) {
    source.on("end", () => {
      if (++completedReads === positionStreams.length) {
        csvWriteStream.end();
      }
    });

    source.pipe(csvWriteStream, { end: false });
  }
}
