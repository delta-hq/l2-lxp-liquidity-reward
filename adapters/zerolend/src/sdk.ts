interface IResponse {
  data: {
    userReserves: IData[];
  };
}

interface IData {
  user: {
    id: string;
  };
  currentTotalDebt: string;
  currentATokenBalance: string;
  reserve: {
    underlyingAsset: string;
    symbol: string;
    name: string;
  };
  liquidityRate: "0";
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: number;
  token_symbol: string;
  usd_price: number;
};

export interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const queryURL =
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/zerolend-linea/1.0.0/gn";

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = blocks.blockTimestamp;
  const first = 1000;
  const rows: OutputDataSchemaRow[] = [];

  let lastAddress = "0x0000000000000000000000000000000000000000";

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

    const response = await fetch(queryURL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    const batch: IResponse = await response.json();

    if (!batch.data || batch.data.userReserves.length == 0) break;

    batch.data.userReserves.forEach((data: IData) => {
      const balance =
        BigInt(data.currentATokenBalance) - BigInt(data.currentTotalDebt);

      if (balance !== 0n)
        rows.push({
          block_number: blocks.blockNumber,
          timestamp,
          user_address: data.user.id,
          token_address: data.reserve.underlyingAsset,
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
