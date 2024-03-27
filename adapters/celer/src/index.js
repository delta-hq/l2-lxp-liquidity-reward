import { write } from "fast-csv";
import fs from "fs";

const exportCSV = async (blockNumber, blockTimestamp) => {
  console.log("downloading...");
  const csvRows = [];
  const res = await fetch(
    `https://cbridge-prod2.celer.app/v1/getLineaLiquiditySnapshot?linea_block_number=${blockNumber}&linea_block_timestamp=${blockTimestamp}`
  );
  const resData = await res.json();
  resData.entries?.forEach((item) => {
    csvRows.push({
      user: "0x" + item.user_address,
      pool: item.token_address,
      block: blockNumber,
      lpvalue: item.token_balance,
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

exportCSV(19506984, 1711429021);
