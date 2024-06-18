import { CHAINS, PROTOCOLS } from "./sdk/config";
import {  checkMostRecentVaultPositionsInRange, getUnderlyingBalance, getUserSharesByVaultAtTime, getVaultsCreatedBefore } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import csv from "csv-parser";
import { write } from 'fast-csv';
import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';
import { getCurrentTickAtBlock } from "./sdk/chainReads";



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
  usd_price?: number; //assign 0 if not available
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

        // get Vault holdings
        const vaultHoldings = await getUnderlyingBalance(CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER, vault.vault, blocks.blockTimestamp)
        // not deposit
        if (vaultHoldings[0] == 0n) continue

        const userHoldings = await getUserSharesByVaultAtTime(CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER, vault.vault, blocks.blockTimestamp)
        if (Object.keys(userHoldings).length) {
          // fetch USD for LPT
          // let value = 0
          // const url = `https://api.steer.finance/pool/lp/value?chain=${CHAINS.L2_CHAIN_ID}&address=${vault.vault}`
          // try {
          //   const res = await fetch(url);
          //   if (!res.ok) {
          //     throw new Error(`Steer pricing api error - Status: ${res.status}`);
          //   }
          //   const data = await res.json()
          //   value =  data.pricePerLP
          // } catch (error) {
          //   // fallback keep 0
          // }
          // if (!value) value = 0;

          // format obj to add
          for (const sender in userHoldings) {
            if (userHoldings.hasOwnProperty(sender) && userHoldings[sender] > 0){
              csvRows.push({
                block_number: blocks.blockNumber,
                timestamp: blocks.blockTimestamp,
                user_address: sender.toLowerCase(),
                token_address: vault.token0.toLowerCase(),
                token_balance: userHoldings[sender] * vaultHoldings[1] / vaultHoldings[0], // get user proportion of total vault holdings of each token
                token_symbol: vault.token0Symbol,
                usd_price: 0 // Number(userHoldings[sender]) * value / 1e18
              })
              csvRows.push({
                block_number: blocks.blockNumber,
                timestamp: blocks.blockTimestamp,
                user_address: sender.toLowerCase(),
                token_address: vault.token1.toLowerCase(),
                token_balance: userHoldings[sender] * vaultHoldings[2] / vaultHoldings[0], // get user proportion of total vault holdings of each token
                token_symbol: vault.token1Symbol,
                usd_price: 0 // Number(userHoldings[sender]) * value / 1e18
              })
            }
          }
        }
      }
    }
  // } 

  // Write the CSV output to a file
  // const ws = fs.createWriteStream('outputData.csv');
  // write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
  //   console.log("CSV file has been written.");
  // });
  return csvRows
};

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on('data', (row) => {
          const blockNumber = parseInt(row.number, 10);
          const blockTimestamp = parseInt(row.timestamp, 10);
          if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
          }
      })
      .on('end', () => {
          resolve();
      })
      .on('error', (err) => {
          reject(err);
      });
  });

  return blocks;
  };

  readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; 

    for (const block of blocks) {
        try {
            const result = await getUserTVLByBlock(block);
            allCsvRows.push(...result);
        } catch (error) {
            console.error(`An error occurred for block ${block}:`, error);
        }
    }
    await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
        write(allCsvRows, { headers: true })
            .pipe(ws)
            .on("finish", () => {
            console.log(`CSV file has been written.`);
            resolve;
            });
    });

    }).catch((err) => {
    console.error('Error reading CSV file:', err);
    });

// getData().then(() => {
//   console.log("Done");
// });
// getPrice(new BigNumber('1579427897588720602142863095414958'), 6, 18); //Uniswap
// getPrice(new BigNumber('3968729022398277600000000'), 18, 6); //SupSwap

