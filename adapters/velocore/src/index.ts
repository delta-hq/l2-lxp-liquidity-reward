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
import { BlockData, OutputSchemaRow } from "./sdk/types";
BigNumber.set({ EXPONENTIAL_AT: 256 });

const getData = async () => {
  const snapshotBlocks = [2999728];

  const csvRows: OutputSchemaRow[] = [];

  for (let block of snapshotBlocks) {
    const timestamp = await getTimestampAtBlock(block);
    csvRows.push(
      ...(await getUserTVLByBlock({
        blockNumber: block,
        blockTimestamp: timestamp,
      }))
    );
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

export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputSchemaRow[]> => {
  const result: OutputSchemaRow[] = [];

  const [userStakes, userVotes] = await Promise.all([
    getUserStakesForAddressByPoolAtBlock(blockNumber, "", ""),
    getUserVoteForAddressByPoolAtBlock(blockNumber, ""),
  ]);
  console.log(`Block: ${blockNumber}`);
  console.log("UserStakes: ", userStakes.length);
  console.log("UserVotes: ", userVotes.length);

  const tokenBalanceMap = {} as {
    [userAddress: string]: { [tokenAddress: string]: BigNumber };
  };

  const gauges = await getGaugesAtBlock(blockNumber);
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
      result.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address,
        token_address,
        token_balance: BigInt(token_balance.dp(0).toString()),
        token_symbol: "",
        usd_price: 0,
      });
    });
  });
  return result;
};
