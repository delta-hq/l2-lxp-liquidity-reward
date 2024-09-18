import csv from "csv-parser";
import fs from "fs";
import { write } from "fast-csv";

const Linea = 59_144;

type PoolSchemaRow = {
  chain_id: number;
  creation_block_number: number;
  timestamp: number;
  underlying_token_address: string;
  underlying_token_symbol: string;
  receipt_token_address: string;
  receipt_token_symbol: string;
  pool_address: string;
  pool_type: string;
};

type PositionSnapshotSchemaRow = {
  timestamp: number;
  block_date: string;
  chain_id: number;
  pool_address: string;
  underlying_token_address: string;
  underlying_token_symbol: string;
  user_address: string;
  supplied_amount: bigint;
  supplied_amount_usd?: bigint;
  borrowed_amount: bigint;
  borrowed_amount_usd?: bigint;
  collateral_amount?: bigint;
  collateral_amount_usd?: bigint;
};

type PoolSnapshotSchemaRow = {
  timestamp: number;
  block_date: string;
  chain_id: number;
  pool_address: string;
  underlying_token_address: string;
  underlying_token_symbol: string;
  underlying_token_price_usd?: number;
  available_amount: bigint;
  available_amount_usd?: bigint;
  supplied_amount: bigint;
  supplied_amount_usd?: bigint;
  non_recursive_supplied_amount: bigint;
  collateral_amount?: bigint;
  collateral_amount_usd?: bigint;
  collateral_factor: number;
  supply_index: number;
  supply_apr: number;
  borrowed_amount: bigint;
  borrowed_amount_usd?: bigint;
  borrow_index: number;
  borrow_apr: number;
  total_fees_usd?: number;
  user_fees_usd?: number;
  protocol_fees_usd?: number;
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

const queryAllAssets = async (block: number): Promise<Asset[]> => {
  const query = async (
    block: number,
    first: number,
    skip: number,
  ): Promise<Asset[]> => {
    const query = `query ContangoAssets {
      assets(
        block: {number: ${block}}
        first: ${first}
        skip: ${skip}
      ) {
        id
        symbol
      }
    }`;

    return await graphQuery(query).then((json) => json.data.assets);
  };

  let assets: Asset[] = [];
  let skip = 0;
  do {
    assets.push(...(await query(block, PAGE_SIZE, skip)));
    skip += PAGE_SIZE;
  } while (assets.length === PAGE_SIZE);

  return assets;
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:00:00`;
}

export const getPoolsByBlock = async (
  block: BlockData,
): Promise<PoolSchemaRow[]> => {
  const assets = await queryAllAssets(block.blockNumber);
  return assets.map(({ id, symbol }) => {
    return {
      chain_id: Linea,
      creation_block_number: 0,
      timestamp: 0,
      underlying_token_address: id,
      underlying_token_symbol: symbol,
      receipt_token_address: "",
      receipt_token_symbol: "",
      pool_address: id,
      pool_type: "isolated",
    };
  });
};

type Pool = string
type User = string

export const getPositionSnapshotsByBlock = async (
  block: BlockData,
): Promise<PositionSnapshotSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = block;
  const positions = await queryAllPositions(blockNumber);

  const positionsByUser = new Map<User, Map<Pool, PositionSnapshotSchemaRow>>();

  positions.forEach((position) => {
    const { owner, collateral, debt, instrument } = position;
    const { base, quote } = instrument;

    if(!positionsByUser.has(owner)) {
      positionsByUser.set(owner, new Map<Pool, PositionSnapshotSchemaRow>());
    }
    const userPositions = positionsByUser.get(owner)!;

    if (!userPositions.has(base.id)) {
      userPositions.set(base.id, {
        timestamp: blockTimestamp,
        block_date: formatDate(new Date(blockTimestamp * 1000)),
        chain_id: Linea,
        pool_address: base.id,
        underlying_token_address: base.id,
        underlying_token_symbol: base.symbol,
        user_address: owner,
        supplied_amount: BigInt(collateral),
        borrowed_amount: 0n,
      });
    } else {
      userPositions.get(base.id)!.supplied_amount += BigInt(collateral);
    }

    if (!userPositions.has(quote.id)) {
      userPositions.set(quote.id, {
        timestamp: blockTimestamp,
        block_date: formatDate(new Date(blockTimestamp * 1000)),
        chain_id: Linea,
        pool_address: quote.id,
        underlying_token_address: quote.id,
        underlying_token_symbol: quote.symbol,
        user_address: owner,
        supplied_amount: 0n,
        borrowed_amount: BigInt(debt),
      });
    } else {
      userPositions.get(quote.id)!.borrowed_amount += BigInt(debt);
    }
  });

  return Array.from(positionsByUser.values()).flatMap((positions) => Array.from(positions.values()));
};

export const getPoolSnapshotsByBlock = async (
  block: BlockData,
): Promise<PoolSnapshotSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = block;
  const positions = await queryAllPositions(blockNumber);

  const results = new Map<string, PoolSnapshotSchemaRow>();

  positions.forEach((position) => {
    const { owner, collateral, debt, instrument } = position;
    const { base, quote } = instrument;

    if (!results.has(base.id)) {
      results.set(base.id, {
        timestamp: blockTimestamp,
        block_date: formatDate(new Date(blockTimestamp * 1000)),
        chain_id: Linea,
        pool_address: base.id,
        underlying_token_address: base.id,
        underlying_token_symbol: base.symbol,
        available_amount: 0n,
        supplied_amount: BigInt(collateral),
        non_recursive_supplied_amount: BigInt(collateral),
        collateral_factor: 0,
        supply_index: 0,
        supply_apr: 0,
        borrowed_amount: 0n,
        borrow_index: 0,
        borrow_apr: 0,

      });
    } else {
      const pool = results.get(base.id)!;
      pool.supplied_amount += BigInt(collateral)
      pool.non_recursive_supplied_amount += BigInt(collateral)
    }

    if (!results.has(quote.id)) {
      results.set(quote.id, {
        timestamp: blockTimestamp,
        block_date: formatDate(new Date(blockTimestamp * 1000)),
        chain_id: Linea,
        pool_address: quote.id,
        underlying_token_address: quote.id,
        underlying_token_symbol: quote.symbol,
        available_amount: 0n,
        supplied_amount: 0n,
        non_recursive_supplied_amount: 0n,
        collateral_factor: 0,
        supply_index: 0,
        supply_apr: 0,
        borrowed_amount: BigInt(debt),
        borrow_index: 0,
        borrow_apr: 0,
      });
    } else {
      const pool = results.get(quote.id)!;
      pool.borrowed_amount += BigInt(debt);
    }
  });

  return Array.from(results.values());
}

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

const main = async (fileName: string, fn: (block: BlockData) => Promise<any>) =>
  readBlocksFromCSV("hourly_blocks.csv").then(async (blocks: any[]) => {
    console.log(`Processing ${blocks.length} blocks for ${fileName}...`);
    console.log(blocks);
    const allCsvRows: any[] = [];
    let i = 0;

    for (const block of blocks) {
      const blockNumber = block.blockNumber;
      if (!blockNumber || blockNumber < 8030000) {
        throw new Error(`Block number ${blockNumber} is invalid`);
      }

      try {
        const rows = await fn(block);
        console.log(`Block ${blockNumber} has ${rows.length} rows.`);

        allCsvRows.push(...rows);
      } catch (error) {
        console.error(`An error occurred for block ${block}:`, error);
      }
    }

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(fileName, { flags: "w" });
      write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
          console.log(`CSV [${allCsvRows.length}] file has been written.`);
          resolve;
        });
    });
  });

console.log("Starting...");
main("pools.csv", getPoolsByBlock)
main("positionSnapshots.csv", getPositionSnapshotsByBlock)
main("poolSnapshots.csv", getPoolSnapshotsByBlock)
