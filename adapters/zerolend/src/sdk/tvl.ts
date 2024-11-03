import axios from "axios";
import rateLimit from "axios-rate-limit";
import {
  BlockData,
  IUserReserve,
  ILPResponse,
  OutputDataSchemaRow,
} from "./types";

const axiosInstance = rateLimit(axios.create(), {
  maxRequests: 5,
  perMilliseconds: 1000,
});

const queryURL =
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/zerolend-obl-linea/1.0.0/gn";

export const getUserTVLLegacyByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = blocks.blockTimestamp;
  const first = 1000;
  const rows: OutputDataSchemaRow[] = [];

  let lastAddress = "0x0000000000000000000000000000000000000000";

  console.log("working on legacy lending pool data");
  do {
    const query = `{
      userReserves(
        block: {number: ${blocks.blockNumber}}
        where: {and: [{or: [{currentTotalDebt_gt: 0}, {currentATokenBalance_gt: 0}]}, {user_gt: "${lastAddress}"}]}
        first: ${first}
      ) {
        user {
          id
        }
        currentTotalDebt
        currentATokenBalance
        reserve {
          underlyingAsset
          symbol
          name
        }
        liquidityRate
      }
    }`;

    const response = await axiosInstance.post(
      queryURL,
      { query },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const batch: ILPResponse = await response.data;

    if (!batch.data || batch.data.userReserves.length == 0) break;

    batch.data.userReserves.forEach((data: IUserReserve) => {
      const balance =
        BigInt(data.currentATokenBalance) - BigInt(data.currentTotalDebt);

      if (balance !== 0n)
        rows.push({
          block_number: blocks.blockNumber,
          timestamp,
          user_address: data.user.id,
          token_address: data.reserve.underlyingAsset,
          token_balance: BigInt(balance),
          token_symbol: data.reserve.symbol,
          usd_price: 0,
        });

      lastAddress = data.user.id;
    });

    console.log(
      `Processed ${rows.length} rows. Last address is ${lastAddress}`
    );
  } while (true);

  return rows;
};
