import { CHAINS, PROTOCOLS, RPC_URLS } from "./sdk/config";
import { Depositor, VaultPositions, checkMostRecentVaultPositionsInRange, getDepositors, getUserSharesByVaultAtTime, getVaultsCreatedBefore } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import { ethers } from 'ethers';

import { write } from 'fast-csv';
import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';
import { getCurrentTickAtBlock } from "./sdk/chainReads";
import Big from "big.js";



// interface CSVRow {
//   user: string;
//   vaultId: string;
//   block: number;
//   lpvalue: string;
//   poolId: string,
//   positions: number
// }

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const pipeline = promisify(stream.pipeline);


export const getUserTVLByBlock  = async (blocks: BlockData) => {
  // const getData = async () => { // FOR TESTING
  // const snapshotBlocks: BlockData[] = [
  //   // {blockNumber: 5339627, blockTimestamp: 123}, {blockNumber: 5447950, blockTimestamp: 124}, {blockNumber: 5339736, blockTimestamp: 125}
  //   {blockNumber: 4153440, blockTimestamp: 1714306343}
  // ]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');


  
  let csvRows: OutputDataSchemaRow[] = [];

  // for (let block of snapshotBlocks) {
    const vaults = await getVaultsCreatedBefore(CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER, blocks.blockTimestamp)
    for (let i = 0; i < vaults.length; i++) {
      const vault = vaults[i];
      // check was in range
      const tick = await getCurrentTickAtBlock(vault.pool, blocks.blockNumber)
      const wasInRange = await checkMostRecentVaultPositionsInRange(CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER, vault.vault, blocks.blockTimestamp, tick)
      if (wasInRange) {
        const userHoldings = await getUserSharesByVaultAtTime(CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER, vault.vault, blocks.blockTimestamp)
        if (Object.keys(userHoldings).length) {
          // fetch USD for LPT
          let value = 0
          const url = `https://api.steer.finance/pool/lp/value?chain=${CHAINS.L2_CHAIN_ID}&address=${vault.vault}`
          try {
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`Steer pricing api error - Status: ${res.status}`);
            }
            const data = await res.json()
            value =  data.pricePerLP
          } catch (error) {
            // fallback keep 0
          }
          if (!value) value = 0;

          // format obj to add
          for (const sender in userHoldings) {
            if (userHoldings.hasOwnProperty(sender) && userHoldings[sender] > 0){
              csvRows.push({
                block_number: blocks.blockNumber,
                timestamp: blocks.blockTimestamp,
                user_address: sender,
                token_address: vault.vault,
                token_balance: userHoldings[sender],
                token_symbol: '',
                usd_price: value // Number(userHoldings[sender]) * value / 1e18
              })
            }
          }
        }
      }
    }
  // } 

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
};

// getData().then(() => {
//   console.log("Done");
// });
// getPrice(new BigNumber('1579427897588720602142863095414958'), 6, 18); //Uniswap
// getPrice(new BigNumber('3968729022398277600000000'), 18, 6); //SupSwap

