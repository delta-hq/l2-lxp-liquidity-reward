import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
import {
  agEthToRsEth,
  agETHTotalLiquid,
  getEtherumBlock,
  getRsETHBalance,
  getRsETHPrice,
  getWRsETHBalance,
  rsETHTotalSupply
} from "./lib/fetcher";
import { rsETH } from "./lib/utils";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { getAllAgEthHodlers } from "./lib/query";
import { UserBalanceSubgraphEntry } from "./lib/models";
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
};

const getMultiplierPercent = (tvlInUSD: BigNumber) => {
  if (tvlInUSD.lt(100_000_000)) {
    return 138;
  } else if (tvlInUSD.lt(300_000_000)) {
    return 144;
  } else if (tvlInUSD.lt(500_000_000)) {
    return 150;
  } else if (tvlInUSD.lt(800_000_000)) {
    return 156;
  }
  return 156;
};

export const getRsEthTVLInUSD = async (blockNumber: number) => {
  const [rsETHBalanceRaw, wrsETHBalanceRaw, rsEthPrice] = await Promise.all([
    getRsETHBalance(blockNumber),
    getWRsETHBalance(blockNumber),
    getRsETHPrice(blockNumber)
  ]);

  const rsETHBalance = new BigNumber(ethers.utils.formatEther(rsETHBalanceRaw));

  const tvlInUSD = rsETHBalance.times(rsEthPrice);
  const lineaTVLInRsEth = BigInt(rsETHBalanceRaw) + BigInt(wrsETHBalanceRaw);

  return {
    tvlInUSD,
    lineaTVLInRsEth,
    rsEthPrice
  };
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;

  const ethBlockNumber = await getEtherumBlock(blockTimestamp);
  console.log(`ETH BLOCK ${ethBlockNumber}, linea block: ${blockNumber}`);

  const [tvl, agEthPerRsEthRate, agEthTotalSupply, allUser] = await Promise.all(
    [
      getRsEthTVLInUSD(blockNumber),
      agEthToRsEth(ethBlockNumber),
      agETHTotalLiquid(ethBlockNumber),
      getAllAgEthHodlers(ethBlockNumber, blockNumber, blockTimestamp)
    ]
  );

  // Total rsETH deposit to mainnet
  const mainnetTVLInRsETH =
    BigInt(agEthTotalSupply * agEthPerRsEthRate) / BigInt(10 ** 18);

  const lineaToMainnetRatio =
    (BigInt(tvl.lineaTVLInRsEth) * BigInt(10 ** 18)) /
    BigInt(mainnetTVLInRsETH);

  const mulPercent = getMultiplierPercent(tvl.tvlInUSD);
  console.log(
    `Ratio linea/mainnet ${ethers.utils.formatEther(
      lineaToMainnetRatio
    )}, lineaTVL : ${ethers.utils.formatEther(
      tvl.lineaTVLInRsEth
    )} rsETH, mainnetTVL: ${ethers.utils.formatEther(
      mainnetTVLInRsETH
    )} rsETH mulPercent: ${mulPercent}`
  );
  const csvRows: OutputDataSchemaRow[] = [];

  allUser.forEach((item: UserBalanceSubgraphEntry) => {
    const userBalance = item.balance;
    const balanceInRsEthRaw = BigInt(userBalance) * BigInt(agEthPerRsEthRate);
    const mainnetUserBalanceRsEth =
      ((balanceInRsEthRaw / BigInt(10 ** 18)) * BigInt(mulPercent)) / 100n;

    const lineaUserBalance =
      (lineaToMainnetRatio * mainnetUserBalanceRsEth) / BigInt(10 ** 18);

    csvRows.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: item.id.toLowerCase(),
      token_address: rsETH.toLowerCase(),
      token_balance: lineaUserBalance,
      token_symbol: "rsETH",
      usd_price: tvl.rsEthPrice.toNumber()
    });
  });

  let totalRsEthSaveToCSV = csvRows.reduce(
    (acc, s) => acc + s.token_balance,
    0n
  );

  const rsEthTotalSupply = await rsETHTotalSupply(blockNumber);

  console.log(
    `TOTAL rsEth balance  in CSV : ${ethers.utils.formatEther(
      totalRsEthSaveToCSV.toString()
    )}\nTOTAL rsETH supply linea: ${ethers.utils.formatEther(
      rsEthTotalSupply.toString()
    )}`
  );

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
        console.error(
          `An error occurred for block ${JSON.stringify(block)}:`,
          error
        );
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
