import { promisify } from 'util';
import stream from 'stream';
import csv from 'csv-parser';
import * as fs from "fs";
import { write } from "fast-csv";
import { ethers } from 'ethers';
import ABI_JSON from "./sdk/v3pair_abi.json";
import { client } from "./sdk/config";
import { VAULT_ADDRESS } from "./sdk/vaults";
import { BlockData, OutputDataSchemaRow, UserTokenAmounts, TokenSymbol } from './sdk/types';
import {
  getTimestampAtBlock,
  getPoolInfoByBlock, 
  getVaultsAllPositionsByBlock, 
  getAmountsForLiquidityByBlock, 
  getUsersShareTokenBalancesByBlock,
  getWrapperUsersShareTokenBalancesByBlock,
  getActualUsersShareTokenBalancesByBlock
} from "./sdk/lib";
import { wrap } from 'module';

const ERC20abi = ["function symbol() view returns (string)"];
const provider = new ethers.JsonRpcProvider(client.transport.url);
const vault_ABI = ABI_JSON;
const pipeline = promisify(stream.pipeline);


// const readBlocksFromCSV = async (filePath: string): Promise<number[]> => {
//     const blocks: number[] = [];
//     await pipeline(
//         fs.createReadStream(filePath),
//         csv(),
//         async function* (source) {
//             for await (const chunk of source) {
//                 // Assuming each row in the CSV has a column 'block' with the block number
//                 if (chunk.block) blocks.push(parseInt(chunk.block, 10));
//             }
//         }
//     );
//     return blocks;
// };

const getData = async () => {
  const blocks = [
    4973414
  ]; //await readBlocksFromCSV('src/sdk/mode_chain_daily_blocks.csv');

  const csvRows: OutputDataSchemaRow[] = [];

  for (const block of blocks) {
      const timestamp = await getTimestampAtBlock(block)
      csvRows.push(...await getUserTVLByBlock({ blockNumber: block, blockTimestamp: timestamp }))
  }

  // Write the CSV output to a file
  const ws = fs.createWriteStream('outputData.csv');
  write(csvRows, { headers: true }).pipe(ws).on('finish', () => {
      console.log("CSV file has been written.");
  });
};

export const getUserTVLByBlock = async ({ blockNumber, blockTimestamp }: BlockData): Promise<OutputDataSchemaRow[]> => {
  const result: OutputDataSchemaRow[] = []
  const amounts: UserTokenAmounts = {};
  const symbols: TokenSymbol = {};

  const mergedShareTokenBalances = await getActualUsersShareTokenBalancesByBlock(blockNumber);
  // console.log('Merged share token balances:', mergedShareTokenBalances);

  for (const vaultAddress of VAULT_ADDRESS) {
    try {
      const contract = new ethers.Contract(vaultAddress, vault_ABI, provider);
      console.log("Processing vault:", vaultAddress);

      // Step 1: Get vault in-range positions by block
      const positionsByBlock = await getVaultsAllPositionsByBlock(contract, blockNumber);
      // Step 2: Get pool info by block
      const poolInfo = await getPoolInfoByBlock(contract, blockNumber);
      // Step 3: Filter positions within the pool tick range
      const inRangePositions = positionsByBlock.filter(
        position => position.tickLower <= poolInfo.tick && position.tickUpper > poolInfo.tick
      );
      
      if (inRangePositions.length === 0) {
        console.log("No in-range positions found for this vault:", vaultAddress);
        continue;
      }
      // Step 4: Get vault token amounts for the in-range liquidity
      let totalAmount0 = 0n;
      let totalAmount1 = 0n;

      for (const position of inRangePositions) {
        const { amount0, amount1 } = await getAmountsForLiquidityByBlock(
          contract,
          position.tickLower,
          position.tickUpper,
          position.liquidity,
          blockNumber
        );
        
        totalAmount0 += BigInt(amount0.toString());
        totalAmount1 += BigInt(amount1.toString());
      }
      // console.log('Total amount 0:', totalAmount0.toString());
      // console.log('Total amount 1:', totalAmount1.toString());

      // Step 5: Get token symbols for token0 and token1 
      if (!symbols[poolInfo.token0]) {
        const token0 = new ethers.Contract(poolInfo.token0, ERC20abi, provider);
        const token0Symbol = await token0.symbol();
        symbols[poolInfo.token0] = token0Symbol;
      }
      if (!symbols[poolInfo.token1]) {
        const token1 = new ethers.Contract(poolInfo.token1, ERC20abi, provider);
        const token1Symbol = await token1.symbol();
        symbols[poolInfo.token1] = token1Symbol;
      }

      // Step 6: Get total supply of share token by block
      const totalSupplyByBlock = await contract.totalSupply({ blockTag: blockNumber });
      // console.log('Total supply by block:', totalSupplyByBlock);
      
      // Step 7: Iterate over user share token balances and calculate token amounts
      if (mergedShareTokenBalances) {
        for (const userBalance of mergedShareTokenBalances) {
          if (userBalance.contractId.toLowerCase() === vaultAddress.toLowerCase() && userBalance.balance > 0n) {
            // Calculate token0 and token1 amounts based on the share ratio
            const token0Amount: bigint = userBalance.balance === 0n || totalSupplyByBlock === 0n
            ? 0n // Handle division by zero or zero balance
            : (userBalance.balance * totalAmount0) / totalSupplyByBlock;

            const token1Amount: bigint = userBalance.balance === 0n || totalSupplyByBlock === 0n
            ? 0n // Handle division by zero or zero balance
            : (userBalance.balance * totalAmount1) / totalSupplyByBlock;
            // console.log('User Token 0 amount:', token0Amount.toString());
            // console.log('User Token 1 amount:', token1Amount.toString());

            // Add token amounts to the user
            if (!amounts[userBalance.user]) {
              amounts[userBalance.user] = {};
            } 
            if (!amounts[userBalance.user][poolInfo.token0]) {
              amounts[userBalance.user][poolInfo.token0] = 0n;
            }
            if (!amounts[userBalance.user][poolInfo.token1]) {
              amounts[userBalance.user][poolInfo.token1] = 0n;
            }
            amounts[userBalance.user][poolInfo.token0] += token0Amount;
            amounts[userBalance.user][poolInfo.token1] += token1Amount;
          }
        }
      } else {
        console.error("usersShareTokenBalances is null.");
      }
    } catch (error) {
      console.error("Error processing vault:", vaultAddress, error);
    }
  }
  // console.log('Amounts:', amounts);
  for (const user in amounts) {
    // Get the token amounts for the current user
    const userTokenAmounts = amounts[user];
    // Add token amounts to the rowData
    for (const token in userTokenAmounts) {
      const amount = userTokenAmounts[token];      
      // Create an OutputDataSchemaRow for the current user
      const rowData: OutputDataSchemaRow = {
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: user,
        token_address: token, // Placeholder for token address
        token_balance: amount, // Placeholder for token balance
        token_symbol: symbols[token], // Placeholder for token symbol
        usd_price: 0, // Assign 0 for usd_price
      };
      result.push(rowData);
    }
  }
  return result;
};

// getData().then(() => {
//   console.log("Done");
// });


const readBlocksFromCSV = async (filePath: string): Promise<BlockData[]> => {
  const blocks: BlockData[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv()) // Specify the separator as '\t' for TSV files
      .on('data', (row) => {
        const blockNumber = parseInt(row.number, 10);
        const blockTimestamp = parseInt(row.timestamp, 10);
        if (!isNaN(blockNumber) && blockTimestamp) {
          blocks.push({ blockNumber: blockNumber, blockTimestamp });
        }
      })
      .on('end', () => {
        resolve();
      })
      .on('error', (err) => {
        reject(err);
      });
  });

  return blocks;
};

readBlocksFromCSV('hourly_blocks.csv').then(async (blocks: BlockData[]) => {
  console.log(blocks);
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 1000; // Size of batch to trigger writing to the file
  let i = 0;

  for (const block of blocks) {
      try {
          const result = await getUserTVLByBlock(block);
          for(let i = 0; i < result.length; i++){
            allCsvRows.push(result[i])
          }
      } catch (error) {
          console.error(`An error occurred for block ${block}:`, error);
      }
  }
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(`outputData.csv`, { flags: 'w' });
    write(allCsvRows, { headers: true })
        .pipe(ws)
        .on("finish", () => {
        console.log(`CSV file has been written.`);
        resolve;
        });
  });
}).catch((err) => {
  console.error('Error reading CSV file:', err);
});
