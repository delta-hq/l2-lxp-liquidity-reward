import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
import { getBeefyVaultConfig } from "./sdk/vault/getBeefyVaultConfig";
import { getVaultBreakdowns } from "./sdk/breakdown/getVaultBreakdown";
import { uniq } from "lodash";
import { BeefyVaultBreakdown } from "./sdk/breakdown/types";
import { Hex } from "viem";
import { getTokenBalances } from "./sdk/vault/getTokenBalances";

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string; //token symbol should be empty string if it is not available
  usd_price: number; //assign 0 if not available
};

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = blocks;

  const [vaultConfigs, investorPositions] = await Promise.all([
    getBeefyVaultConfig("linea"),
    getTokenBalances(BigInt(blockNumber)),
  ]);

  const vaultAddressWithActivePosition = uniq(
    investorPositions.map((pos) => pos.token_address)
  );
  const vaults = vaultConfigs.filter((vault) =>
    vaultAddressWithActivePosition.includes(vault.vault_address)
  );
  // get breakdowns for all vaults
  const breakdowns = await getVaultBreakdowns(BigInt(blockNumber), vaults);

  const breakdownByVaultAddress = breakdowns.reduce((acc, breakdown) => {
    acc[breakdown.vault.vault_address.toLowerCase() as Hex] = breakdown;
    return acc;
  }, {} as Record<Hex, BeefyVaultBreakdown>);

  // merge by investor address and token address
  const investorTokenBalances: Record<
    Hex /* investor */,
    Record<Hex /* token */, bigint /* amount */>
  > = {};
  for (const position of investorPositions) {
    const breakdown = breakdownByVaultAddress[position.token_address];
    if (!breakdown) {
      // some test vaults were never available in the api
      continue;
    }

    if (breakdown.isLiquidityEligible === false) {
      // skip non-eligible vaults
      continue;
    }

    if (!investorTokenBalances[position.user_address]) {
      investorTokenBalances[position.user_address] = {};
    }

    for (const balance of breakdown.balances) {
      if (!investorTokenBalances[position.user_address][balance.tokenAddress]) {
        investorTokenBalances[position.user_address][balance.tokenAddress] =
          BigInt(0);
      }

      investorTokenBalances[position.user_address][balance.tokenAddress] +=
        (BigInt(position.token_address) * balance.vaultBalance) /
        breakdown.vaultTotalSupply;
    }
  }

  // format output
  return Object.entries(investorTokenBalances)
    .map(([investor, balances]) =>
      Object.entries(balances).map(([token, balance]) => ({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: investor,
        token_address: token,
        token_balance: balance,
        token_symbol: "", //token symbol should be empty string if it is not available
        usd_price: 0, //assign 0 if not available
      }))
    )
    .flat();
};

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

readBlocksFromCSV("hourly_blocks.csv")
  .then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        for (let i = 0; i < result.length; i++) {
          allCsvRows.push(result[i]);
        }
      } catch (error) {
        console.error(
          `An error occurred for block ${JSON.stringify(block)}:`,
          error
        );
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
