interface IResponse {
  data: {
    users: IData[];
  };
}

interface IData {
  id: string;
  shareAmount: string;
  collateralAmount: string;
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
        where: {and: [{or: [{shareAmount_gt: 0}, {collateralAmount_gt: 0}]}, {id_gt: "${lastAddress}"}]}
        first: ${first}
      ) {
        id
        shareAmount
        collateralAmount
      }
    }`;

    const response = await fetch(queryURL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    const batch: IResponse = await response.json();

    if (!batch.data || batch.data.users.length == 0) break;

    batch.data.users.forEach((data: IData) => {
      if (BigInt(data.shareAmount) !== 0n)
        rows.push({
          block_number: blocks.blockNumber,
          timestamp,
          user_address: data.id,
          token_address: "0x6EeFDBAd45AA2a688bbD5b7c098c323f05Df2223",
          token_balance: Number(data.shareAmount),
          token_symbol: "fWETH(ezETH)-1",
          usd_price: 0,
        });
      if (BigInt(data.collateralAmount) !== 0n)
          rows.push({
            block_number: blocks.blockNumber,
            timestamp,
            user_address: data.id,
            token_address: "0x2416092f143378750bb29b79eD961ab195CcEea5",
            token_balance: Number(data.collateralAmount),
            token_symbol: "ezETH",
            usd_price: 0,
          });

      lastAddress = data.id;
    });

    console.log(
      `Processed ${rows.length} rows. Last address is ${lastAddress}`
    );
  } while (true);

  return rows;
};
