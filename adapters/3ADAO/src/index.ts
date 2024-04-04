import * as fs from "fs";
import { write } from "fast-csv";
import { OutputDataSchemaRow } from "./sdk/types";
import { getTvlByVaultAtBlock } from "./sdk/helpers";
import { addresses } from "./sdk/config";
import { euro3Price } from "./sdk/euro3Price";
import { BlockData } from "./sdk/interfaces";

//* Goal: Hourly snapshot of TVL by User in his Vault.
//* Note: The calculation is made via RPC calls, as there is no way to calculate the TVL via events in our protocol at a block.

export const getTVLByVault = async (blocks: BlockData, logOutput?: boolean) => {
  const { blockNumber, blockTimestamp } = blocks;
  const csvRowsTvl: OutputDataSchemaRow[] = [];

  const euro3Prices = await euro3Price();
  const { vaultsTvl, owners, collateralsByVaults, balancesByVault } =
    await getTvlByVaultAtBlock(blockNumber);

  for (let i = 0; i < owners.length; i++) {
    for (let j = 0; j < collateralsByVaults[i].length; j++) {
      csvRowsTvl.push({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: owners[i],
        token_address: collateralsByVaults[i][j],
        token_balance: balancesByVault[i][j],
        token_symbol: "",
        usd_price: Number((vaultsTvl[i][j] * euro3Prices.USD).toFixed(2)),
      });
    }
  }

  if (logOutput) console.log(csvRowsTvl);
  return csvRowsTvl;
};

export const main = async (blocks: BlockData[], logOutput?: boolean) => {
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;

  for (const { blockNumber, blockTimestamp } of blocks) {
    try {
      // Retrieve data using block number and timestamp
      const csvRowsTvl = await getTVLByVault(
        {
          blockNumber,
          blockTimestamp,
        },
        logOutput
      );

      allCsvRows.push(...csvRowsTvl);
      i++;
      console.log(`Processed block ${i}`);

      // Write to file when batch size is reached or at the end of loop
      if (i % batchSize === 0 || i === blocks.length) {
        const ws = fs.createWriteStream(`outputData.csv`, {
          flags: i === batchSize ? "w" : "a",
        });
        write(allCsvRows, { headers: i === batchSize ? true : false })
          .pipe(ws)
          .on("finish", () => {
            console.log(`CSV file has been written.`);
          });

        // Clear the accumulated CSV rows
        allCsvRows.length = 0;
      }
    } catch (error) {
      console.error(`An error occurred for block ${blockNumber}:`, error);
    }
  }
};

// * Test
// const when = { blockNumber: 3394331, blockTimestamp: 0 };
// main([when], true);
