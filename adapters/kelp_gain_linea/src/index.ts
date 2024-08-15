import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
import { getRsETHBalance, getRsETHPrice } from "./lib/fetcher";
import { kelpGAIN, rsETH } from "./lib/utils";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
interface BlockData {
  blockTimestamp: number;
  blockNumber: number;
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; // token symbol should be empty string if it is not available
  usd_price: number; // assign 0 if not available
  tvl_usd: string;
  multiplier: number;
};

const getMultiplier = (tvlInUSD: BigNumber) => {
  if (tvlInUSD.lt(100_000_000)) {
    return 1.38;
  } else if (tvlInUSD.lt(300_000_000)) {
    return 1.44;
  } else if (tvlInUSD.lt(500_000_000)) {
    return 1.5;
  } else if (tvlInUSD.lt(800_000_000)) {
    return 1.56;
  }
  return 1.56;
};
export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;

  const [rsETHBalanceRaw, rsEthPrice] = await Promise.all([
    getRsETHBalance(blockNumber),
    getRsETHPrice(blockNumber)
  ]);

  const rsETHBalance = new BigNumber(ethers.utils.formatEther(rsETHBalanceRaw));
  const tvlInUSD = rsETHBalance.times(rsEthPrice);

  const mul = getMultiplier(tvlInUSD);
  const csvRows: OutputDataSchemaRow[] = [];

  csvRows.push({
    block_number: blockNumber,
    timestamp: blockTimestamp,
    user_address: kelpGAIN,
    token_address: rsETH,
    token_balance: BigInt(rsETHBalanceRaw.toString()),
    token_symbol: "rsETH",
    usd_price: rsEthPrice.toNumber(),
    tvl_usd: tvlInUSD.toString(),
    multiplier: mul
  });
  return csvRows;
};

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
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

readBlocksFromCSV("hourly_blocks.csv")
  .then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 1000; // Size of batch to trigger writing to the file
    let i = 0;

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        allCsvRows.push(...result);
      } catch (error) {
        console.error(`An error occurred for block ${block}:`, error);
      }
    }
    await new Promise((resolve, reject) => {
      // const randomTime = Math.random() * 1000;
      // setTimeout(resolve, randomTime);
      const ws = fs.createWriteStream(`outputData.csv`, { flags: "w" });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
          console.log(`CSV file has been written.`);
          resolve;
        });
    });

    // Clear the accumulated CSV rows
    // allCsvRows.length = 0;
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });
