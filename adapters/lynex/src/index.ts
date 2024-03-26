import fs from "fs";
import { write } from "fast-csv";
import { getTimestampAtBlock, getUserAddresses } from "./sdk/subgraphDetails";
import {
  VE_LYNX_ADDRESS,
  fetchUserPools,
  fetchUserVotes,
} from "./sdk/lensDetails";
import BigNumber from "bignumber.js";

interface CSVRow {
  block_number: string;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_balance: string;
}

const getData = async () => {
  const snapshotBlocks = [2999728];

  const csvRows: CSVRow[] = [];

  for (let block of snapshotBlocks) {
    const [userAddresses] = await Promise.all([getUserAddresses(block)]);
    console.log(`Block: ${block}`);
    console.log("UserAddresses: ", userAddresses.length);

    const tokenBalanceMap = {} as {
      [userAddress: string]: { [tokenAddress: string]: BigNumber };
    };

    const userPoolFetch = [];
    const userVotesFetch = [];

    for (const user of userAddresses) {
      userPoolFetch.push(fetchUserPools(BigInt(block), user.id, user.pools));
      userVotesFetch.push(fetchUserVotes(BigInt(block), user.id));
    }

    const userFetchResult = await Promise.all(userPoolFetch);
    const userVotesResult = await Promise.all(userVotesFetch);
    const block_number = block.toString();
    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

    for (const userFetchedPools of userFetchResult) {
      for (const userPool of userFetchedPools) {
        const user_address = userPool.result.userAddress.toLowerCase();
        const totalLPBalance =
          userPool.result.account_lp_balance +
          userPool.result.account_gauge_balance;
        const total0 =
          (totalLPBalance * userPool.result.reserve0) /
          userPool.result.total_supply;
        const total1 =
          (totalLPBalance * userPool.result.reserve1) /
          userPool.result.total_supply;
        const token0Address = userPool.result.token0.toLowerCase();
        const token1Address = userPool.result.token1.toLowerCase();

        // Aggregate tokens
        tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
        tokenBalanceMap[user_address][token0Address] = BigNumber(
          tokenBalanceMap[user_address][token0Address] ?? 0
        ).plus(total0.toString());
        tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
        tokenBalanceMap[user_address][token1Address] = BigNumber(
          tokenBalanceMap[user_address][token1Address] ?? 0
        ).plus(total1.toString());
      }
    }

    for (const userFecthedVotes of userVotesResult) {
      for (const userVote of userFecthedVotes) {
        const user_address = userVote.result.userAddress.toLowerCase();
        const token0Address = VE_LYNX_ADDRESS.toLowerCase();
        tokenBalanceMap[user_address] = tokenBalanceMap[user_address] ?? {};
        tokenBalanceMap[user_address][token0Address] = BigNumber(
          tokenBalanceMap[user_address][token0Address] ?? 0
        ).plus(userVote.result.amount.toString());
      }
    }

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

    const ws = fs.createWriteStream("outputData.csv");
    write(csvRows, { headers: true })
      .pipe(ws)
      .on("finish", () => {
        console.log("CSV file has been written.");
      });
  }
};

getData().then(() => {
  console.log("Done");
});
