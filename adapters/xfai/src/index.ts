import {
  CHAIN_ID,
  RPC_URL,
  SUBGRAPH_URL,
  WETH,
  XFAI_FACTORY,
  XFAI_POOL_INIT,
} from "./config";
import { keccak256, pack } from "@ethersproject/solidity";
import { uniq } from "lodash";
import { multicall } from "./sdk/mutlicall";
import { IXfaiPool__factory } from "./sdk/factories/IXfaiPool__factory";
import { getCreate2Address } from "ethers/lib/utils";
import { StaticJsonRpcProvider } from "@ethersproject/providers";
import { write } from "@fast-csv/format";
import csv from "csv-parser";

import fs from "fs";
function getPoolAddressFromTokenAddress(tokenAddress: string): string {
  return getCreate2Address(
    XFAI_FACTORY,
    keccak256(["bytes"], [pack(["address"], [tokenAddress])]),
    XFAI_POOL_INIT
  );
}

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

async function getProvider() {
  const provider = new StaticJsonRpcProvider(RPC_URL, CHAIN_ID);
  await provider.ready;
  return provider;
}

type ChangedLiquidity = {
  owner: string;
  token: string;
  liquidity: bigint;
};
type ChangedLiquidityWithBlock = ChangedLiquidity & {
  blockNumber: bigint;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getTokenTransfers = async (
  blockNumber: number
): Promise<ChangedLiquidity[]> => {
  const PER_PAGE = 990;
  let skip = 0;
  let fetchNext = true;
  let result: ChangedLiquidity[] = [];
  let lastBlock = 0n;
  loop: while (fetchNext) {
    let query = ` {
        liquidityChanges(first:${PER_PAGE}, skip: ${skip} , where:{ blockNumber_lte: ${blockNumber}, blockNumber_gt: ${lastBlock} }, orderBy: blockNumber, orderDirection: asc) {
          owner
          token
          liquidity
          blockNumber
        }
      }`;

    let response;
    let count = 0;

    do {
      response = await fetch(SUBGRAPH_URL, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });
      if (response.status != 200) {
        console.log("fetching failed. Try again in 15 sec");
        await delay(15000);
      }
      ++count;
    } while (response.status != 200 && count < 10);

    let data = await response.json();
    let positions: ChangedLiquidityWithBlock[] = data.data.liquidityChanges;
    lastBlock = BigInt(positions[positions.length - 1].blockNumber);
    for (let i = 0; i < positions.length; i++) {
      if (
        positions.length === PER_PAGE &&
        BigInt(positions[i].blockNumber) == lastBlock
      ) {
        lastBlock = BigInt(positions[i - 1].blockNumber);
        skip = 0;
        continue loop;
      }
      let position = positions[i];
      result.push({
        owner: position.owner,
        token: position.token,
        liquidity: BigInt(position.liquidity),
      });
    }
    if (positions.length < PER_PAGE) {
      fetchNext = false;
    } else {
      skip += PER_PAGE;
    }
  }
  return result;
};

// group transfers by owner,token and sum liquidity
function getLiquidityFromTransfers(
  transfers: ChangedLiquidity[]
): ChangedLiquidity[] {
  const groupedTransfers: ChangedLiquidity[] = [];
  const transferMap: Map<string, Map<string, bigint>> = new Map();

  for (const transfer of transfers) {
    const { owner, token, liquidity } = transfer;
    const ownerMap = transferMap.get(owner) || new Map();
    const existingLiquidity = ownerMap.get(token) || 0n;
    ownerMap.set(token, existingLiquidity + liquidity);
    transferMap.set(owner, ownerMap);
  }

  for (const [owner, tokenMap] of transferMap) {
    for (const [token, liquidity] of tokenMap) {
      if (liquidity == 0n) {
        continue;
      }
      groupedTransfers.push({ owner, token, liquidity });
    }
  }
  return groupedTransfers;
}

function groupLiquidityByUserAndToken(
  block: BlockData,
  liquidities: Omit<OutputDataSchemaRow, "block_number" | "timestamp">[]
): OutputDataSchemaRow[] {
  const groupedLiquidity: OutputDataSchemaRow[] = [];
  const liquidityMap: Map<string, Map<string, bigint>> = new Map();

  for (const liquidity of liquidities) {
    const { user_address, token_address, token_balance } = liquidity;
    const userMap = liquidityMap.get(user_address) || new Map();
    const existingBalance = userMap.get(token_address) || 0n;
    userMap.set(token_address, existingBalance + token_balance);
    liquidityMap.set(user_address, userMap);
  }

  for (const [user, tokenMap] of liquidityMap) {
    for (const [token, balance] of tokenMap) {
      if (balance === 0n) {
        continue;
      }
      groupedLiquidity.push({
        block_number: Number(block.blockNumber),
        timestamp: block.blockTimestamp,
        user_address: user,
        token_address: token,
        token_balance: balance,
        token_symbol: "",
        usd_price: 0,
      });
    }
  }

  return groupedLiquidity;
}

export async function getUserTVLByBlock(
  block: BlockData
): Promise<OutputDataSchemaRow[]> {
  const provider = await getProvider();

  const transfers = await getTokenTransfers(block.blockNumber);

  const liquidities = getLiquidityFromTransfers(transfers);

  const liquiditiesRows = liquidities.map((r) => ({
    ...r,
    pool: getPoolAddressFromTokenAddress(r.token),
    liquidity: BigInt(r.liquidity),
  }));

  const pools: string[] = uniq(liquiditiesRows.map(({ pool }) => pool));

  const poolReserves = await multicall(
    provider,
    IXfaiPool__factory,
    pools.map((p) => ({
      arguments: [],
      contractAddress: p,
      function_name: "getStates",
    })),
    {
      allowFailure: false,
      callOverrides: {
        blockTag: block.blockNumber,
      },
    }
  );
  const poolSupplies = await multicall(
    provider,
    IXfaiPool__factory,
    pools.map((p) => ({
      arguments: [],
      contractAddress: p,
      function_name: "totalSupply",
    })),
    {
      allowFailure: false,
      callOverrides: {
        blockTag: block.blockNumber,
      },
    }
  );

  const poolRes = Object.fromEntries(
    Object.entries(poolReserves).map(([pool, [reserve, ethReserve]]) => [
      pool,
      {
        reserve,
        ethReserve,
      },
    ])
  );

  const result: Omit<OutputDataSchemaRow, "timestamp" | "block_number">[] =
    liquiditiesRows.flatMap(
      ({ owner, token, pool: poolAddress, liquidity }) => {
        const poolSupply = poolSupplies[poolAddress];
        const poolReserve = poolRes[poolAddress];
        const tokenBalance =
          (liquidity * poolReserve.reserve.toBigInt()) / poolSupply.toBigInt();
        const ethBalance =
          (liquidity * poolReserve.ethReserve.toBigInt()) /
          poolSupply.toBigInt();
        return [
          // Token reserve
          {
            user_address: owner,
            token_address: token,
            token_balance: tokenBalance,
            token_symbol: "",
            usd_price: 0,
          },
          // WETH Reserve
          {
            user_address: owner,
            token_address: WETH,
            token_balance: ethBalance,
            token_symbol: "WETH",
            usd_price: 0,
          },
        ];
      }
    );

  //

  return groupLiquidityByUserAndToken(block, result);
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

readBlocksFromCSV("hourly_blocks.csv")
  .then(async (blocks: any[]) => {
    console.log(blocks);
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        // Accumulate CSV rows for all blocks
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
