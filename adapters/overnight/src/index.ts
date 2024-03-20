import { CHAINS, PROTOCOLS, AMM_TYPES, SNAPSHOTS_BLOCKS } from "./sdk/config";
import { getLPValueByUserAndPoolFromPositions, getPositionsForAddressByPoolAtBlock } from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';

interface CSVRow {
  user: string;
  pool: string;
  block: number;
  position: number;
  lpvalue: string;
}


const getData = async () => {
  const csvRows: CSVRow[] = [];

  for (let block of SNAPSHOTS_BLOCKS) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block, "", "", CHAINS.LINEA, PROTOCOLS.OVN
    );
    // graph init --product subgraph-studio ovn_linea --from-contract 0x58AaCbccAeC30938cb2bb11653Cad726e5c4194a --network linea 
    
    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    // Assuming this part of the logic remains the same
    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);

    lpValueByUsers.forEach((value, key) => {
      value.forEach((lpValue, poolKey) => {
        const lpValueStr = lpValue.toString();
        // Accumulate CSV row data
        csvRows.push({
          user: key,
          pool: poolKey,
          block,
          position: positions.length, // Adjust if you have a specific way to identify positions
          lpvalue: lpValueStr,
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

