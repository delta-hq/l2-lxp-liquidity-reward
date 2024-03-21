import { promisify } from "util";
import stream from "stream";
import csv from "csv-parser";
import fs from "fs";
import { write } from "fast-csv";
import { balancesSnapshotAt } from "./balancesSnapshotAt";

const tokenSymbol = "LUSDC";
const tokenAddress = "0x4AF215DbE27fc030F37f73109B85F421FAB45B7a";

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

const getData = async () => {
  const snapshotBlocks = [3000000, 3043054]; // await readBlocksFromCSV('src/sdk/L2_CHAIN_ID_chain_daily_blocks.csv');

  // Generate balances snapshot for each block
  const csvRows = (
    await Promise.all(
      snapshotBlocks.map((block) =>
        balancesSnapshotAt(BigInt(block), tokenSymbol, tokenAddress)
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
