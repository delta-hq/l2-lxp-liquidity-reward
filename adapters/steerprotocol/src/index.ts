import { CHAINS, PROTOCOLS, RPC_URLS } from "./sdk/config";
import { Depositor, VaultPositions, getDepositors, getVaultPositions } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import { ethers } from 'ethers';

import { write } from 'fast-csv';
import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';



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


const getData = async () => {
  const snapshotBlocks: BlockData[] = [
    // {blockNumber: 5339627, blockTimestamp: 123}, {blockNumber: 5447950, blockTimestamp: 124}, {blockNumber: 5339736, blockTimestamp: 125}
    {blockNumber: 4153440, blockTimestamp: 1714306343}
  ]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');


  
  let csvRows: OutputDataSchemaRow[] = [];

  for (let block of snapshotBlocks) {
    // const depositors = await getDepositorsForAddressByVaultAtBlock(block.blockNumber, block.blockTimestamp, "", "", CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER);
    const depositors = await getDepositors(block.blockNumber, block.blockTimestamp, "", "", CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER);

    const vaultSet = new Set()
    for (let i = 0; i < depositors.length; i++) {
      vaultSet.add(depositors[i].vault.id)
    }
    const vaultArray = Array.from(vaultSet)
    const vaultLPT_usd = new Map()
    for (let index = 0; index < vaultArray.length; index++) {
      const url = `https://api.steer.finance/pool/lp/value?chain=${CHAINS.L2_CHAIN_ID}&address=${vaultArray[index]}`
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Steer pricing api error - Status: ${res.status}`);
        }
        const data = await res.json()
        vaultLPT_usd.set(vaultArray[index], data.pricePerLP)
      } catch (error) {
        // fallback to 0
        vaultLPT_usd.set(vaultArray[index], 0)
      }
    }

    const depositorsRow: OutputDataSchemaRow[] = depositors.map((depositor: Depositor) => {
      return {
        // user_address: depositor.sender,
        // vaultId: depositor.vault.id,
        // poolId: depositor.vault.pool,
        // block: Number(depositor.blockNumber),
        // lpvalue: (depositor.shares * vaultLPT_usd.get(depositor.vault.pool)).toString()
        // lpvalue: depositor.shares.toString()
        block_number: depositor.blockNumber,
        timestamp: depositor.timestamp,
        user_address: depositor.sender,
        token_address: depositor.vault.id,
        token_balance: depositor.shares,
        token_symbol: '',
        usd_price: Number(depositor.shares * vaultLPT_usd.get(depositor.vault.pool))
      } as OutputDataSchemaRow
    });

    csvRows = csvRows.concat(depositorsRow);
  } 

  // const vaultsPositions: {
  //   [key: string]: VaultPositions[]
  // } = {};

  // for (const csvRow of csvRows) {
  //   let vaultPositions = [];

  //   if (vaultsPositions[csvRow.vaultId]) {
  //     vaultPositions = vaultsPositions[csvRow.vaultId];
  //   } else {
  //     vaultPositions = await getVaultPositions( CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER, csvRow.vaultId)
  //     vaultsPositions[csvRow.vaultId] = vaultPositions;
  //   }

  //   csvRow.positions = vaultPositions[0].lowerTick.length;
  // }

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
    console.log("CSV file has been written.");
  });
};

getData().then(() => {
  console.log("Done");
});
// getPrice(new BigNumber('1579427897588720602142863095414958'), 6, 18); //Uniswap
// getPrice(new BigNumber('3968729022398277600000000'), 18, 6); //SupSwap

