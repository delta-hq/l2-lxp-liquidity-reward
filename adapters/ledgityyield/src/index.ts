import { promisify } from "util";
import stream from "stream";
import csv from "csv-parser";
import fs from "fs";
import { write } from "fast-csv";
import { getUserTVLByBlock } from "./getUserTVLByBlock";
import { client } from "./client";

const pipeline = promisify(stream.pipeline);
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

const getBlockTimestamp = async (blockNumber: bigint): Promise<number> => {
  const blockInfos = await client.getBlock({
    blockNumber,
  });
  return Number(blockInfos.timestamp);
};

const getData = async () => {
  const snapshotBlocks = [3000000, 3043054]; // await readBlocksFromCSV('src/sdk/L2_CHAIN_ID_chain_daily_blocks.csv');

  // Generate balances snapshot for each block
  const csvRows = (
    await Promise.all(
      snapshotBlocks.map(async (block) =>
        getUserTVLByBlock({
          blockNumber: block,
          blockTimestamp: await getBlockTimestamp(BigInt(block)),
        })
      )
    )
  ).flat();

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
