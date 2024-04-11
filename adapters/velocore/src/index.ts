(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import fs from "fs";
import { write } from "fast-csv";
import {
  getTimestampAtBlock,
  getUserStakesForAddressByPoolAtBlock,
  getUserVoteForAddressByPoolAtBlock,
} from "./sdk/subgraphDetails";
import { getGaugesAtBlock, VE_VC_ADDRESS } from "./sdk/lensDetails";
import BigNumber from "bignumber.js";

interface CSVRow {
  block_number: string;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_balance: string;
}

const getData = async (blocks) => {
  const snapshotBlocks = [2999728];

  const csvRows: CSVRow[] = [];

  for (let block of snapshotBlocks) {
    const [userStakes, userVotes] = await Promise.all([
      getUserStakesForAddressByPoolAtBlock(block, "", ""),
      getUserVoteForAddressByPoolAtBlock(block, ""),
    ]);
    console.log(`Block: ${block}`);
    console.log("UserStakes: ", userStakes.length);
    console.log("UserVotes: ", userVotes.length);

    const tokenBalanceMap = {} as {
      [userAddress: string]: { [tokenAddress: string]: BigNumber };
    };

    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();
    const block_number = block.toString();
    const gauges = await getGaugesAtBlock(block);
    userStakes.forEach((userStake) => {
      const user_address = userStake.owner.toLowerCase();
      const lpBalance = userStake.balance;
      const underlyingTokens = gauges[userStake.poolId.toLowerCase()];
      if (!underlyingTokens) {
        // old pool
        return;
      }
      underlyingTokens.forEach(({ address, amountPerLp }) => {
        const token_address = address.toLowerCase();
        const token_balance = amountPerLp.times(lpBalance);
        tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
        tokenBalanceMap[user_address][token_address] = BigNumber(
          tokenBalanceMap[user_address][token_address] ?? 0
        ).plus(token_balance);
      });
    });

    userVotes.forEach((userVote) => {
      const user_address = userVote.owner.toLowerCase();
      const token_balance = userVote.balance;
      const token_address = VE_VC_ADDRESS.toLowerCase();
      tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
      tokenBalanceMap[user_address][token_address] = BigNumber(
        tokenBalanceMap[user_address][token_address] ?? 0
      ).plus(token_balance);
    });

    Object.entries(tokenBalanceMap).forEach(([user_address, balances]) => {
      Object.entries(balances).forEach(([token_address, token_balance]) => {
        if (token_balance.dp(0).lte(0)) {
          return;
        }
        csvRows.push({
          block_number,
          timestamp,
          user_address,
          token_address,
          token_balance: token_balance.dp(0).toString(),
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

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on('data', (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.block_timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      });
  });

  return blocks;
};

readBlocksFromCSV('src/hourly_blocks.csv').then(async (blocks) => {
  console.log(blocks);
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 1000; // Size of batch to trigger writing to the file
  let i = 0;

  allCsvRows.push({ block_number: 'block_number', timestamp: 'timestamp', user_address: 'user_address', token_address: 'token_address', token_balance: 'token_balance', token_symbol: 'token_symbol', usd_price: 'usd_price' });
  for (const block of blocks) {
      try {
          const result = await getUserTVLByBlock(block);

          // Accumulate CSV rows for all blocks
          allCsvRows.push(...result);

          i++;
          // console.log(`Processed block ${i}`);

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
          console.error(`An error occurred for block ${block}:`, error);
      }

  }
  }).catch((err) => {
  console.error('Error reading CSV file:', err);
});

// getData().then(() => {
//   console.log("Done");
// });
