import csv from "csv-parser";
import fs from "fs";
import { write } from "fast-csv";
import { PAGE_SIZE, PROTOCOLS, SUBGRAPH_URLS } from "./config";
import { AccountBalances, BlockData, OutputDataSchemaRow } from "./types";


const post = async (url: string, data: any): Promise<any> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

const getAccountData = async (
  protocol: PROTOCOLS,
  lastId = "0"
): Promise<AccountBalances> => {
  const ACCOUNTS_QUERY = `query {
    accounts(
      first: ${PAGE_SIZE},
      where: { id_gt: "${lastId}" },
      orderBy: id,
      orderDirection: asc,
    ){
      id
      hypervisorShares(
        first: 1000,
        where: { shares_gt:0 },
      ) {
        hypervisor {
          id
          pool {
            token0 {
              id
              symbol
            },
            token1 {
              id
              symbol
            },
          },
          totalSupply,
          tvl0,
          tvl1,
          tvlUSD,
        },
        shares,
        initialToken0,
        initialToken1,
        initialUSD,
      }
    }
  }`;

  const responseJson = await post(SUBGRAPH_URLS[protocol], {
    query: ACCOUNTS_QUERY,
  });

  let accountHoldings: AccountBalances = {};
  for (const account of responseJson.data.accounts) {
    for (const hypeShare of account.hypervisorShares) {
      accountHoldings[account.id] ??= {};

      const shareOfPool = hypeShare.shares / hypeShare.hypervisor.totalSupply;
      const tvl0Share = Math.round(shareOfPool * hypeShare.hypervisor.tvl0);
      const tvl1Share = Math.round(shareOfPool * hypeShare.hypervisor.tvl1);

      const token0Address: string = hypeShare.hypervisor.pool.token0.id;
      const token1Address: string = hypeShare.hypervisor.pool.token1.id;

      if (token0Address in accountHoldings) {
        accountHoldings[account.id][token0Address].balance += tvl0Share;
      } else {
        accountHoldings[account.id][token0Address] = {
          symbol: hypeShare.hypervisor.pool.token0.symbol,
          balance: tvl0Share,
        };
      }

      if (token1Address in accountHoldings) {
        accountHoldings[account.id][token1Address].balance += tvl1Share;
      } else {
        accountHoldings[account.id][token1Address] = {
          symbol: hypeShare.hypervisor.pool.token1.symbol,
          balance: tvl1Share,
        };
      }
    }
  }

  if (responseJson.data.accounts.length == PAGE_SIZE) {
    const lastRecord = responseJson.data.accounts[
      responseJson.data.accounts.length - 1
    ] as any;
    accountHoldings = {
      ...accountHoldings,
      ...(await getAccountData(protocol, lastRecord.id)),
    };
  }

  return accountHoldings;
};

export const main = async (blocks: BlockData[]) => {
  const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
  const batchSize = 10; // Size of batch to trigger writing to the file
  let i = 0;

  for (const block of blocks) {
    try {
      // Retrieve data using block number and timestamp
      const csvRows = await getUserTVLByBlock(block);

      // Accumulate CSV rows for all blocks
      allCsvRows.push(...csvRows);

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
      console.error(`An error occurred for block ${block.blockNumber}:`, error);
    }
  }
};

export const getUserTVLByBlock = async (blocks: BlockData) => {
  const { blockNumber, blockTimestamp } = blocks;
  //    Retrieve data using block number and timestamp

  const protocolData: AccountBalances[] = await Promise.all([
    getAccountData(PROTOCOLS.UNISWAP),
    getAccountData(PROTOCOLS.LYNEX),
    getAccountData(PROTOCOLS.LINEHUB),
    getAccountData(PROTOCOLS.NILE),
  ]);

  const allProtocolHoldings: AccountBalances = {};

  // // Aggregate data from all protocols
  protocolData.forEach((protocol) => {
    Object.entries(protocol).forEach(([userAddress, tokens]) => {
      allProtocolHoldings[userAddress] ??= {};
      Object.entries(tokens).forEach(([tokenAddress, token]) => {
        if (tokenAddress in allProtocolHoldings[userAddress]) {
          allProtocolHoldings[userAddress][tokenAddress].balance +=
            token.balance;
        } else {
          allProtocolHoldings[userAddress][tokenAddress] = {
            symbol: token.symbol,
            balance: token.balance,
          };
        }
      });
    });
  });

  // Transform to required output
  const csvRows: OutputDataSchemaRow[] = [];

  Object.entries(allProtocolHoldings).forEach(
    ([userAddress, tokenBalances]) => {
      Object.entries(tokenBalances).forEach(([tokenAddress, token]) => {
        csvRows.push({
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: userAddress,
          token_address: tokenAddress,
          token_balance: token.balance,
          token_symbol: token.symbol,
          usd_price: 0, // Not available
        });
      });
    }
  );

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
    const allCsvRows: any[] = []; // Array to accumulate CSV rows for all blocks
    const batchSize = 1000; // Size of batch to trigger writing to the file
    let i = 0;

    for (const block of blocks) {
      try {
        const result = await getUserTVLByBlock(block);
        allCsvRows.push(...result);
      } catch (error) {
        console.error(
          `An error occurred for block ${block.blockNumber}:`,
          error
        );
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
