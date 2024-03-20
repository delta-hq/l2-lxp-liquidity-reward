import BigNumber from "bignumber.js";
import { CHAINS, PROTOCOLS, AMM_TYPES, SNAPSHOTS_BLOCKS } from "./sdk/config";
import { getLPValueByUserAndPoolFromPositions, getPositionsForAddressByPoolAtBlock } from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';

interface LPValueDetails {
  pool: string;
  lpValue: string;
}

interface UserLPData {
  totalLP: string;
  pools: LPValueDetails[];
}

// Define an object type that can be indexed with string keys, where each key points to a UserLPData object
interface OutputData {
  [key: string]: UserLPData;
}

const getData = async () => {
  // Object to hold the final structure for JSON output
  let outputData: OutputData = {};

  for (let block of SNAPSHOTS_BLOCKS) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block, "", "", CHAINS.LINEA, PROTOCOLS.OVN
    );

    console.log(`Block: ${block}`);
    console.log("Positions: ", positions.length);

    let positionsWithUSDValue = positions;
    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positionsWithUSDValue);

    lpValueByUsers.forEach((value, key) => {
      if (!outputData[key]) {
        outputData[key] = { totalLP: "0", pools: [] };
      }

      let total = new BigNumber(outputData[key].totalLP);
      value.forEach((lpValue, poolKey) => {
        const lpValueStr = lpValue.toString();
        outputData[key].pools.push({ pool: poolKey, lpValue: lpValueStr });
        total = total.plus(lpValue);
      });

      outputData[key].totalLP = total.toString();
    });
  }

  // Writing the JSON output to a file
  fs.writeFile('outputData.json', JSON.stringify(outputData, null, 2), 'utf8', (err) => {
    if (err) {
      console.log("An error occurred while writing JSON Object to File.");
      return console.log(err);
    }
    console.log("JSON file has been saved.");
  });
};

getData().then(() => {
  console.log("Done");
});

// getPrice(new BigNumber('1579427897588720602142863095414958'), 6, 18); //Uniswap
// getPrice(new BigNumber('3968729022398277600000000'), 18, 6); //SupSwap

