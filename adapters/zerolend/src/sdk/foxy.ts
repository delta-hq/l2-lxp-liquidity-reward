import {
  BlockData,
  IUserReserve,
  ILPResponse,
  OutputDataSchemaRow,
} from "./types";

const queryURL =
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/zerolend-linea-foxy/1.0.0/gn";

export const getUserTVLFoxyByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = blocks.blockTimestamp;
  const first = 1000;
  const rows: OutputDataSchemaRow[] = [];

  let lastAddress = "0x0000000000000000000000000000000000000000";

  const remapFoxy = (addr: string) =>
    addr == "0x5fbdf89403270a1846f5ae7d113a989f850d1566"
      ? "0x000000000000000000000000000000000000foxy"
      : addr;

  console.log("working on foxy data");
  do {
    const query = `{
      userReserves(
        first: ${first}
        where: {user_gt: "${lastAddress}"}
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

    const response = await fetch(queryURL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    const batch: ILPResponse = await response.json();

    if (!batch.data || batch.data.userReserves.length == 0) break;

    batch.data.userReserves.forEach((data: IUserReserve) => {
      const balance =
        BigInt(data.currentATokenBalance) - BigInt(data.currentTotalDebt);

      if (balance !== 0n)
        rows.push({
          block_number: blocks.blockNumber,
          timestamp,
          user_address: data.user.id,
          token_address: remapFoxy(data.reserve.underlyingAsset),
          token_balance: Number(balance),
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
