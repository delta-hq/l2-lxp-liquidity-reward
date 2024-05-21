import * as fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
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

export const getUserTVLByBlock = async (
  blocks: BlockData[],
  logOutput?: boolean
) => {
  const allCsvRows: OutputDataSchemaRow[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;

  for (let i = 0; i < blocks.length; i++) {
    const { blockNumber, blockTimestamp } = blocks[i];
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
        // allCsvRows.length = 0;
      }
    } catch (error) {
      console.error(`An error occurred for block ${blockNumber}:`, error);
    }
  }
  return allCsvRows;
};

// * Test
// const when = { blockNumber: 3394331, blockTimestamp: 0 };
// getUserTVLByBlock ([when], true);

const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on("data", (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on("end", () => {
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      });
  });

  return blocks;
};

readBlocksFromCSV("./hourly_blocks.csv")
  .then(async (blocks: any[]) => {
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
      const ws = fs.createWriteStream(`outputData.csv`, { flags: "w" });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
          console.log(`CSV file has been written.`);
          resolve;
        });
    });
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });
