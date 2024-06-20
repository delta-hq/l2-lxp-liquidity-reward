interface IResponse {
  data: {
    users: IData[];
  };
}

interface IData {
  id: string;
  pairs: IUserPair[];
}

interface IUserPair {
  assetAmount: string;
  collateralAmount: string;
  debtAssetAmount: string;
  pair: IPair;
}

interface IPair {
  asset: IAsset;
  collateralAsset: IAsset;
}

interface IAsset {
  id: string;
  symbol: string;
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
  "https://api.goldsky.com/api/public/project_clxapj31qxfaf01xc54w88dn6/subgraphs/sturdy-linea-silo/1.0.0/gn";

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = blocks.blockTimestamp;
  const first = 1000;
  const rows: OutputDataSchemaRow[] = [];

  let lastAddress = "0x0000000000000000000000000000000000000000";

  do {
    const query = `{
      users(
        block: {number: ${blocks.blockNumber}}
        where: {id_gt: "${lastAddress}"}
        first: ${first}
      ) {
        id
        pairs(
          where: {or: [{assetAmount_gt: 0}, {collateralAmount_gt: 0}, {debtAssetAmount_gt: 0}]}
        ) {
          assetAmount
          collateralAmount
          debtAssetAmount
          pair {
            asset {
              id
              symbol
            }
            collateralAsset {
              id
              symbol
            }
          }
        }
      }
    }`;

    const response = await fetch(queryURL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    const batch: IResponse = await response.json();

    if (!batch.data || batch.data.users.length == 0) break;

    const usersInfo = {} as any;
    batch.data.users.forEach((data: IData) => {
      data.pairs.forEach((userPair: IUserPair) => {
        if (!usersInfo[data.id])
          usersInfo[data.id] = {} as any;

        if (BigInt(userPair.assetAmount) !== 0n) {
          if (!usersInfo[data.id][userPair.pair.asset.id])
            usersInfo[data.id][userPair.pair.asset.id] = { amount: 0, symbol: userPair.pair.asset.symbol }
          usersInfo[data.id][userPair.pair.asset.id]['amount'] += Number(userPair.assetAmount);
        }

        if (BigInt(userPair.collateralAmount) !== 0n) {
          if (!usersInfo[data.id][userPair.pair.collateralAsset.id])
            usersInfo[data.id][userPair.pair.collateralAsset.id] = { amount: 0, symbol: userPair.pair.collateralAsset.symbol }
          usersInfo[data.id][userPair.pair.collateralAsset.id]['amount'] += Number(userPair.collateralAmount);
        }

        if (BigInt(userPair.debtAssetAmount) !== 0n) {
          if (!usersInfo[data.id][userPair.pair.asset.id])
            usersInfo[data.id][userPair.pair.asset.id] = { amount: 0, symbol: userPair.pair.asset.symbol }
          usersInfo[data.id][userPair.pair.asset.id]['amount'] -= Number(userPair.debtAssetAmount);
        }
      })

      lastAddress = data.id;
    });

    for (let user of Object.keys(usersInfo)) {
      for (let token of Object.keys(usersInfo[user])) {
        rows.push({
          block_number: blocks.blockNumber,
          timestamp,
          user_address: user,
          token_address: token,
          token_balance: usersInfo[user][token]['amount'],
          token_symbol: usersInfo[user][token]['symbol'],
          usd_price: 0,
        });
      }
    }

    console.log(
      `Processed ${rows.length} rows. Last address is ${lastAddress}`
    );
  } while (true);

  return rows;
};
