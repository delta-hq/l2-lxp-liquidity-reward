import csv from "csv-parser";
import fs from "fs";
import { write } from "fast-csv";

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string;
  usd_price?: number;
};
interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const PAGE_SIZE = 1_000;

type Asset = {
  id: string;
  symbol: string;
};

type Position = {
  owner: string;
  collateral: string;
  debt: string;
  instrument: {
    base: Asset;
    quote: Asset;
  };
};

const graphQuery = async (query: string) => {
  return await fetch(
    `https://subgraph.satsuma-prod.com/ec9157ac5152/egills-team/contango-linea-points/api`,
    {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ query }),
      method: "POST",
    },
  ).then((res) => res.json());
};

const queryAllPositions = async (block: number): Promise<Position[]> => {
  const query = async (
    block: number,
    first: number,
    skip: number,
  ): Promise<Position[]> => {
    const query = `query ContangoPositions {
      positions(
        block: {number: ${block}}
        first: ${first}
        skip: ${skip}
      ) {
        owner
        collateral
        debt
        instrument {
          base {
            id
            symbol
          }
          quote {
            id    
            symbol    
          }
        }
      }
    }`;

    return await graphQuery(query).then((json) => json.data.positions);
  };

  let positions: Position[] = [];
  let skip = 0;
  do {
    positions.push(...(await query(block, PAGE_SIZE, skip)));
    skip += PAGE_SIZE;
  } while (positions.length === PAGE_SIZE);

  return positions;
};

type User = string;
type AssetAddress = string;
enum Side {
  Collateral,
  Debt,
}

const row = (
  block: BlockData,
  owner: User,
  asset: Asset,
): OutputDataSchemaRow => {
  return {
    block_number: block.blockNumber,
    timestamp: block.blockTimestamp,
    user_address: owner,
    token_address: asset.id,
    token_balance: 0n,
    token_symbol: asset.symbol,
  };
};

export const getUserTVLByBlock = async (
  block: BlockData,
): Promise<OutputDataSchemaRow[]> => {
  const positions = await queryAllPositions(block.blockNumber);
  console.log(
    `Processing block ${block.blockNumber} with ${positions.length} positions`,
  );

  const positionsByUser = new Map<User, Map<AssetAddress, Map<Side,OutputDataSchemaRow >>>();

  positions.forEach((position) => {
    const { owner, collateral, debt, instrument } = position;
    const { base, quote } = instrument;

    if (!positionsByUser.has(owner)) {
      positionsByUser.set(owner, new Map<AssetAddress, Map<Side,OutputDataSchemaRow >>());
    }
    const userAssets = positionsByUser.get(owner)!;

    if (!userAssets.has(base.id)) {
      userAssets.set(base.id, new Map<Side,OutputDataSchemaRow >());
    }
    if (!userAssets.has(quote.id)) {
      userAssets.set(quote.id, new Map<Side,OutputDataSchemaRow >());
    }
    if (!userAssets.get(base.id)!.has(Side.Collateral)) {
      userAssets.get(base.id)!.set(Side.Collateral, row(block, owner, base));
    }
    if (!userAssets.get(quote.id)!.has(Side.Debt)) {
      userAssets.get(quote.id)!.set(Side.Debt, row(block, owner, quote));
    }

    userAssets.get(base.id)!.get(Side.Collateral)!.token_balance += BigInt(collateral);
    userAssets.get(quote.id)!.get(Side.Debt)!.token_balance -= BigInt(debt);
  });

  return Array.from(positionsByUser.values())
    .flatMap((positions) => Array.from(positions.values()))
    .flatMap((sides) => Array.from(sides.values()))
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
    const batchSize = 1000; // Size of batch to trigger writing to the file
    let i = 0;

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        allCsvRows.push(...result);
      } catch (error) {
        console.error(`An error occurred for block ${block}:`, error);
      }
    }
    await new Promise((resolve, reject) => {
      // const randomTime = Math.random() * 1000;
      // setTimeout(resolve, randomTime);
      const ws = fs.createWriteStream(`outputData.csv`, { flags: "w" });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
          console.log(`CSV file has been written.`);
          resolve;
        });
    });

    // Clear the accumulated CSV rows
    // allCsvRows.length = 0;
  })
  .catch((err) => {
    console.error("Error reading CSV file:", err);
  });
