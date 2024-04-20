import { CHAINS, PROTOCOLS, SNAPSHOTS_BLOCKS, OVN_CONTRACTS, LP_LYNEX, LP_LYNEX_SYMBOL, USD_PLUS_SYMBOL, USD_PLUS_LINEA, USDT_PLUS_SYMBOL, USDT_PLUS_LINEA } from "./sdk/config";
import { Position, getLPValueByUserAndPoolFromPositions, getPositionsForAddressByPoolAtBlock, getRebaseForUsersByPoolAtBlock, getTimestampAtBlock } from "./sdk/subgraphDetails";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import fs from 'fs';
import { write } from 'fast-csv';
import BN from "bignumber.js";

interface CSVRow {
  block_number: string;
  timestamp: string;
  user_address: string;
  token_address: string;
  token_balance: string;
  token_symbol: string;
}

const getData = async () => {
  const csvRows_pools: CSVRow[] = [];
  const csvRows_rebase: CSVRow[] = [];
  
  for (let block of SNAPSHOTS_BLOCKS) {
    const positions = await getPositionsForAddressByPoolAtBlock(
      block, "", "", CHAINS.LINEA, PROTOCOLS.OVN
    );
    console.log("Positions: ", positions.length);
    let lpValueByUsers = getLPValueByUserAndPoolFromPositions(positions);
    // all results are counted for the END block
    const timestamp = new Date(await getTimestampAtBlock(block)).toISOString();

    lpValueByUsers.forEach((value, key) => {
      value.forEach((lpValue) => {
          const lpValueStr = lpValue.toString();
          // Accumulate CSV row data
          csvRows_pools.push({
            user_address: key,
            token_address: LP_LYNEX,
            token_symbol: LP_LYNEX_SYMBOL,
            token_balance: lpValueStr,
            block_number: block.toString(),
            timestamp
        });
      })
    });
  }

  for (let [index, block] of SNAPSHOTS_BLOCKS.entries()) {
    console.log(`Block: ${block}`);
    let positionsRebaseUsd: Map<string, string> = new Map()
    let positionsRebaseUsdt: Map<string, string> = new Map()
    if (!SNAPSHOTS_BLOCKS[index + 1]) return
    console.log(block, '__index')
    if (SNAPSHOTS_BLOCKS[index + 1]) {
      positionsRebaseUsd = await getRebaseForUsersByPoolAtBlock(
        block, SNAPSHOTS_BLOCKS[index + 1], CHAINS.LINEA, PROTOCOLS.OVN_REBASE, OVN_CONTRACTS.USDPLUS
      );
    }
    if (SNAPSHOTS_BLOCKS[index + 1]) {
      positionsRebaseUsdt = await getRebaseForUsersByPoolAtBlock(
        block, SNAPSHOTS_BLOCKS[index + 1], CHAINS.LINEA, PROTOCOLS.OVN_REBASE, OVN_CONTRACTS.USDTPLUS
      );
    }
    console.log(`Block: ${block}`);
    console.log("positionsRebase: ", positionsRebaseUsd.size);

    // all results are counted for the END block
    const timestamp = new Date(await getTimestampAtBlock(SNAPSHOTS_BLOCKS[index + 1])).toISOString();


    positionsRebaseUsd.forEach((value, key) => {
      csvRows_rebase.push({
        user_address: key,
        token_symbol: USD_PLUS_SYMBOL,
        token_balance: value,
        token_address: USD_PLUS_LINEA,
        block_number: SNAPSHOTS_BLOCKS[index + 1].toString(),
        timestamp
      });
    });

    positionsRebaseUsdt.forEach((value, key) => {
      csvRows_rebase.push({
        user_address: key,
        token_symbol: USDT_PLUS_SYMBOL,
        token_balance: value,
        token_address: USDT_PLUS_LINEA,
        block_number: SNAPSHOTS_BLOCKS[index + 1].toString(),
        timestamp
      });
    });
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData_pools.csv');
  const ws_rebase = fs.createWriteStream('outputData_rebase.csv');
  write(csvRows_pools, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
  write(csvRows_rebase, { headers: true }).pipe(ws_rebase).on('finish', () => {
    console.log("CSV file has been written.");
  });
};

getData().then(() => {
  console.log("Done");
});

