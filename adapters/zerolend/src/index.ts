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
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/zerolend-linea/1.0.0/gn";

const getBlockNumber = async () => {
  const data = {
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: 83,
  };

  const res = await fetch("https://rpc.linea.build", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

  const json = await res.json();
  return Number(json.result);
};

export const main = async (): Promise<OutputDataSchemaRow[]> => {
  const timestamp = Date.now();
  const first = 1000;
  const rows: OutputDataSchemaRow[] = [];
  const blockNumber = await getBlockNumber();

  let lastAddress = "0x0000000000000000000000000000000000000000";

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

    if (batch.data.userReserves.length <= 2) break;

    batch.data.userReserves.forEach((data: IData) => {
      const balance =
        BigInt(data.currentATokenBalance) - BigInt(data.currentTotalDebt);

      if (balance !== 0n)
        rows.push({
          block_number: blockNumber,
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

export const getUserTVLByBlock = async (_blocks: BlockData) => await main();

main().then(async (data) => {
  console.log("Done", data);
  await writeCSV(data);
});
