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

export const main = async () => {
  const blockNumber = await lineaProvider.getBlockNumber();
  const timestamp = new Date();
  const first = 1000;

  let lastAddress = "0x0000000000000000000000000000000000000000";
  const queryURL =
    "https://api.studio.thegraph.com/query/65585/zl-linea-points/version/latest";
  const rows: string[][] = [];

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
        rows.push([
          String(blockNumber),
          String(timestamp.toISOString()),
          data.user.id,
          data.reserve, // Retrieve corresponding address from assetAddresses
          balance.toString(),
        ]);

      lastAddress = data.user.id;
    });

    console.log(`Processed ${rows.length} rows`);
    await writeCSV(rows);
  } while (true);
};

export const writeCSV = async (data: string[][]) => {
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
  data.forEach((row: any) => {
    csvStream.write(row);
  });

  csvStream.on("finish", () => {
    console.log("CSV file has been written successfully.");
    csvStream.end();
  });
};

main().then(() => {
  console.log("Done");
});
