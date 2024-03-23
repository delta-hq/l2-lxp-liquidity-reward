import { CHAINS, PROTOCOLS } from "./sdk/config";
import { VaultPositions, getDepositorsForAddressByVaultAtBlock, getVaultPositions } from "./sdk/subgraphDetails";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { write } from 'fast-csv';
import fs from 'fs';
import stream from 'stream';
import { promisify } from 'util';



interface CSVRow {
  user: string;
  vaultId: string;
  block: number;
  lpvalue: string;
  poolId: string,
  positions: number
}


const pipeline = promisify(stream.pipeline);


const getData = async () => {
  const snapshotBlocks = [
    5339627, 5447950, 5339736
  ]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');
  
  let csvRows: CSVRow[] = [];

  for (let block of snapshotBlocks) {
    const depositors = await getDepositorsForAddressByVaultAtBlock(
      block, "", "", CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER
    );

    const depositorsRow: CSVRow[] = depositors.map((depositor) => {
      return {
        user: depositor.account,
        vaultId: depositor.vault.id,
        poolId: depositor.vault.pool,
        block: Number(depositor.blockNumber),
        lpvalue: depositor.shares.toString()
      } as CSVRow
    });

    csvRows = csvRows.concat(depositorsRow);
  } 

  const vaultsPositions: {
    [key: string]: VaultPositions[]
  } = {};

  for (const csvRow of csvRows) {
    let vaultPositions = [];

    if (vaultsPositions[csvRow.vaultId]) {
      vaultPositions = vaultsPositions[csvRow.vaultId];
    } else {
      vaultPositions = await getVaultPositions( CHAINS.L2_CHAIN_ID, PROTOCOLS.STEER, csvRow.vaultId)
      vaultsPositions[csvRow.vaultId] = vaultPositions;
    }

    csvRow.positions = vaultPositions[0].lowerTick.length;
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
// getPrice(new BigNumber('1579427897588720602142863095414958'), 6, 18); //Uniswap
// getPrice(new BigNumber('3968729022398277600000000'), 18, 6); //SupSwap

