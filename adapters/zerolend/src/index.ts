import { write } from "fast-csv";
import fs from "fs";

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

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const queryURL =
  "https://api.studio.thegraph.com/query/65585/zerolend-linea-market/version/latest";

export const main = async (
  blockNumber: number,
  blockTimestamp: number
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = new Date();
  const first = 1000;

  let lastAddress = "0x0000000000000000000000000000000000000000";
  const rows: OutputDataSchemaRow[] = [];

  do {
    const query = `{
      userReserves(
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

    if (batch.data.userReserves.length <= 1) break;

    batch.data.userReserves.forEach((data: IData) => {
      const balance =
        BigInt(data.currentATokenBalance) - BigInt(data.currentTotalDebt);

      if (balance !== 0n)
        rows.push({
          block_number: blockNumber,
          timestamp: blockTimestamp,
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

export const writeCSV = async (data: OutputDataSchemaRow[]) => {
  // File path where the CSV will be saved
  const filePath = "outputData.csv";
  const headers = [
    "block_number",
    "timestamp",
    "user_address",
    "token_address",
    "token_balance",
    "token_symbol",
  ];

  // Create a write stream
  const fileStream = fs.createWriteStream(filePath);

  // Create a CSV writer
  const csvStream = write([]);

  csvStream.pipe(fileStream);
  csvStream.write(headers);
  data.forEach((row) => {
    csvStream.write([
      row.block_number,
      row.timestamp,
      row.user_address,
      row.token_address,
      row.token_balance,
      row.token_symbol,
    ]);
  });

  csvStream.on("finish", () => {
    console.log("CSV file has been written successfully.");
    csvStream.end();
  });
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  return await main(blockNumber, blockTimestamp);
};

main(0, 0).then(async (data) => {
  console.log("Done", data);
  await writeCSV(data);
});
