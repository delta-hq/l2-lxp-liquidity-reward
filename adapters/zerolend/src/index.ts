import { ethers } from "ethers";
import { write } from "fast-csv";
import axios from "axios";
import fs from "fs";

const lineaProvider = new ethers.JsonRpcProvider("https://rpc.linea.build	");

interface IResponse {
  data: {
    userReserves: {
      supplyBalance: string;
      debtBalance: string;
      reserve: string;
      user: {
        id: string;
      };
    }[];
  };
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
  "https://api.studio.thegraph.com/query/65585/zl-linea-points/version/latest";

const symbolMapping: { [key: string]: string } = {
  "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f": "WETH",
  "0xf3b001d64c656e30a62fbaaca003b1336b4ce12a": "MAI",
  "0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "USDC",
  "0xa219439258ca9da29e9cc4ce5596924745e12b93": "USDT",
  "0x2416092f143378750bb29b79ed961ab195cceea5": "ezETH",
  "0x894134a25a5fac1c2c26f1d8fbf05111a3cb9487": "GRAI",
  "0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4": "WBTC",
};
export const main = async (
  blockNumber: number,
  blockTimestamp: number
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = new Date();
  const first = 1000;

  let lastAddress = "0x0000000000000000000000000000000000000000";
  const rows: OutputDataSchemaRow[] = [];

  do {
    const query = `query {
      userReserves(where: {id_gt: "${lastAddress}"}, first: ${first}) {
        supplyBalance
        debtBalance
        reserve
        user {
          id
        }
      }
    }`;

    const headers = {
      "Content-Type": "application/json",
    };
    const batch = await axios.post<IResponse>(queryURL, { query }, { headers });
    if (batch.data.data.userReserves.length <= 1) break;

    batch.data.data.userReserves.forEach((data) => {
      const balance = BigInt(data.supplyBalance) - BigInt(data.debtBalance);

      if (balance !== 0n)
        rows.push({
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: data.user.id,
          token_address: data.reserve,
          token_balance: Number(balance),
          token_symbol: symbolMapping[data.reserve.toLowerCase()] || "",
          usd_price: 0,
        });

      lastAddress = data.user.id;
    });

    console.log(`Processed ${rows.length} rows`);
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
    ]);
  });

  csvStream.on("finish", () => {
    console.log("CSV file has been written successfully.");
    csvStream.end();
  });
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  const csvRowsVessels = await main(blockNumber, blockTimestamp);
  return csvRowsVessels;
};

main(0, 0).then(async (data) => {
  console.log("Done", data);
  await writeCSV(data);
});
