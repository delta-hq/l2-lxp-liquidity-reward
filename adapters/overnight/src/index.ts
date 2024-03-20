import { CHAINS, LP_LYNEX, PROTOCOLS, SNAPSHOTS_BLOCKS } from "./sdk/config";
import { getLPValueByUserAndPoolFromPositions, getPositionsForAddressByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';

interface CSVRow {
  block_number: string;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_balance: string;
}


const getData = async () => {
  const csvRows: CSVRow[] = [];

  for (let block of SNAPSHOTS_BLOCKS) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block, "", "", CHAINS.LINEA, PROTOCOLS.OVN
    );
    
    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);

    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

    lpValueByUsers.forEach((value, key) => {
      value.forEach((lpValue, poolKey) => {
        const lpValueStr = lpValue.toString();
        // Accumulate CSV row data
        csvRows.push({
          user_address: key,
          token_address: LP_LYNEX,
          token_balance: lpValueStr,
          block_number: block.toString(),
          timestamp
        });
      });
    });
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
};

getData().then(() => {
  console.log("Done");
});

