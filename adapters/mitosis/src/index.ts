import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";

const assetWhitelist = ["miezETH", "miweETH", "miuniETH"];

const GRAPHQL_ENDPOINT =
  "https://api.goldsky.com/api/public/project_clxioqhjdzy1901wmgqmp2ygj/subgraphs/mitosis-linea-lxp/1.1.3/gn";

const makeBalancesQuery = (blockNumber: number, next = "") => `query {
  tokenBalances(
    block: {number: ${blockNumber}},
    first: 1000,
    where: { id_gt: "${next}" }
  ) {
    token {
      id
      symbol
    }
    account {
      id
    }
    value
    id
  }
}`;

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

interface TokenBalance {
  token: {
    id: string;
    symbol: string;
  };
  account: {
    id: string;
  };
  value: string;
  id: string;
}

interface TokenBalancesResponse {
  tokenBalances: TokenBalance[];
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

async function post<T = any>(url: string, query: any): Promise<{ data: T }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query }),
  });

  return response.json();
}

const toOutput = (
  { blockNumber, blockTimestamp }: BlockData,
  { tokenBalances }: TokenBalancesResponse
): OutputDataSchemaRow[] =>
  tokenBalances
    .map((v) => ({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: v.account.id,
      token_address: v.token.id,
      token_balance: BigInt(v.value),
      token_symbol: v.token.symbol,
      usd_price: 0,
    }))
    .filter((v) => assetWhitelist.includes(v.token_symbol));

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  let next = "";
  let output: OutputDataSchemaRow[] = [];

  while (true) {
    const { data: resp } = await post<TokenBalancesResponse>(
      GRAPHQL_ENDPOINT,
      makeBalancesQuery(blocks.blockNumber, next)
    );
    if (resp.tokenBalances.length === 0) break;

    output = output.concat(toOutput(blocks, resp));
    next = resp.tokenBalances[resp.tokenBalances.length - 1].id;
  }

  return output;
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
