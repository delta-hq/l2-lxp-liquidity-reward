import { write } from "fast-csv";
import fs from "fs";

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}
interface entriesData {
  user_address: string;
  token_address: string;
  token_balance: string;
}
interface callbackData {
  linea_block_number: string;
  linea_block_timestamp: string;
  entries: Array<entriesData>;
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

export const getUserTVLByBlock = async (data: BlockData) => {
  console.log("downloading...");
  const { blockNumber, blockTimestamp } = data;
  const csvRows: OutputDataSchemaRow[] = [];
  const res = await fetch(
    `https://cbridge-prod2.celer.app/v1/getLineaLiquiditySnapshot?linea_block_number=${blockNumber}&linea_block_timestamp=${blockTimestamp}`
  );
  const resData: callbackData = (await res.json()) as callbackData;
  resData.entries?.forEach((item: any) => {
    csvRows.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: "0x" + item.user_address,
      token_address: item.token_address,
      token_balance: item.token_balance,
      token_symbol: "",
      usd_price: 0,
    });
  });
  // Write the CSV output to a file
  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });
};

getUserTVLByBlock({ blockNumber: 19506984, blockTimestamp: 1711429021 });
