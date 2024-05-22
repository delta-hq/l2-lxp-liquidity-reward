import fs from "fs";
import { write } from "fast-csv";
import csv from "csv-parser";
import BigNumber from "bignumber.js";

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

//const BEEFY_LRT_SUBGRAPH_URL =
//  "https://api.goldsky.com/api/public/project_clu2walwem1qm01w40v3yhw1f/subgraphs/beefyfinance/lrt-linea/gn";
const BEEFY_LRT_SUBGRAPH_URL =
  "https://api.0xgraph.xyz/subgraphs/name/beefyfinance/lrt-linea";
const PAGE_SIZE = 1000;

// https://kx58j6x5me.execute-api.us-east-1.amazonaws.com/linea/getLineaAssets
// found in https://www.openblocklabs.com/app/linea/dashboard
const ELIGIBLE_ASSETS = [
  ["inETH", "0x5a7a183b6b44dc4ec2e3d2ef43f98c5152b1d76d"],
  ["nextDAI", "0x7360a597290612787833ee924c449c61cc0689e4"],
  ["DAI", "0x4af15ec2a0bd43db75dd04e62faa3b8ef36b00d5"],
  ["LYU", "0xb20116ee399f15647bb1eef9a74f6ef3b58bc951"],
  ["USDe", "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34"],
  ["MAI", "0xf3b001d64c656e30a62fbaaca003b1336b4ce12a"],
  ["frxETH", "0xecc68d0451e20292406967fe7c04280e5238ac7d"],
  ["EURO3", "0x3f817b28da4940f018c6b5c0a11c555ebb1264f9"],
  ["wstETH", "0xb5bedd42000b71fdde22d3ee8a79bd49a568fc8f"],
  ["LUSDC", "0x4af215dbe27fc030f37f73109b85f421fab45b7a"],
  ["alxUSDC", "0xeb466342c4d449bc9f53a865d5cb90586f405215"],
  ["mpETH", "0xda7d3ef7c899079eb101f3b31c272dbe9639bda6"],
  ["nextUSDC", "0x331152ca43b50b39f3a9f203685b98dbb9b42342"],
  ["GRAI", "0x894134a25a5fac1c2c26f1d8fbf05111a3cb9487"],
  ["wBTC", "0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4"],
  ["wETH", "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f"],
  ["sUSDE", "0x211cc4dd073734da055fbf44a2b4667d5e5fe5d2"],
  ["SolvBTC", "0x5ffce65a40f6d3de5332766fff6a28bf491c868c"],
  ["weETH", "0x1bf74c010e6320bab11e2e5a532b5ac15e0b8aa6"],
  ["M-BTC", "0xe4d584ae9b753e549cae66200a6475d2f00705f7"],
  ["agEUR", "0x1a7e4e63778b4f12a199c062f3efdd288afcbce8"],
  ["USDT+", "0x1e1f509963a6d33e169d9497b11c7dbfe73b7f13"],
  ["USD+", "0xb79dd08ea68a908a97220c76d19a6aa9cbde4376"],
  ["nextUSDT", "0xbd7eaed30936670c931b718f5d9014aff82fc767"],
  ["USDC", "0x176211869ca2b568f2a7d4ee941e073a821ee1ff"],
  ["USDT", "0xa219439258ca9da29e9cc4ce5596924745e12b93"],
  ["uniETH", "0x15eefe5b297136b8712291b632404b66a8ef4d25"],
  ["ezETH", "0x2416092f143378750bb29b79ed961ab195cceea5"],
  ["wrsETH", "0xd2671165570f41bbb3b0097893300b6eb6101e6c"],
  ["ETH", "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"],
  ["nextWETH", "0x0573ad07ca4f74757e5b2417bf225bebebcf66d9"],
  ["ankrETH", "0x11d8680c7f8f82f623e840130eb06c33d9f90c89"],
  ["wDAI", "0x023617babed6cef5da825bea8363a5a9862e120f"],
  ["STONE", "0x93f4d0ab6a8b4271f4a28db399b5e30612d21116"],
];

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const { blockTimestamp } = blocks;
  const csvRows: OutputDataSchemaRow[] = [];

  // find out which 1h period the block belongs to
  const hour = 3600;
  const roundedTimestamp = Math.floor(blockTimestamp / hour) * hour;

  let skip = 0;
  while (true) {
    const query = `
      query LrtBalanceSnapshots($period: BigInt!, $tokens: [String!]!, $roundedTimestamp: BigInt!, $skip: Int!, $first: Int!) {
        snapshots: investorTokenBalanceSnapshots(
          where: { period: $period, rawBalance_gt: 0, roundedTimestamp: $roundedTimestamp, token_in: $tokens },
          first: $first,
          skip: $skip,
        ) {
          investor {
            id
          }
          token {
            id
            symbol
          }
          rawBalance
          lastUpdateBlock
          lastUpdateTimestamp
        }
      }
    `;

    const response = await fetch(BEEFY_LRT_SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({
        query,
        variables: {
          period: hour,
          skip,
          first: PAGE_SIZE,
          roundedTimestamp,
          tokens: ELIGIBLE_ASSETS.map(([, address]) => address),
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const {
      data: { snapshots },
    } = await response.json();

    for (const snapshot of snapshots) {
      csvRows.push({
        block_number: snapshot.lastUpdateBlock,
        timestamp: snapshot.lastUpdateTimestamp,
        user_address: snapshot.investor.id,
        token_address: snapshot.token.id,
        token_balance: BigInt(snapshot.rawBalance),
        token_symbol: snapshot.token.symbol,
        usd_price: 0,
      });
    }

    if (snapshots.length < PAGE_SIZE) {
      break;
    }

    skip += PAGE_SIZE;
  }

  return csvRows;
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
