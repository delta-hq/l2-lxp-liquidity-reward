import * as fs from "fs";
import { format, write } from "fast-csv";

const excludedAddresses = new Set([
  "0x8a90d208666deec08123444f67bf5b1836074a67", // Mendi
  "0x0684fc172a0b8e6a65cf4684edb2082272fe9050", // Zerolend
  "0x76b0d13428eb01f12f132aa58707d254c42df568", // Nilev2
  "0xa9a1fb9f6664a0b6bfb1f52724fd7b23842248c5", // Nilev2
  "0x6ba5ccc757541851d610ecc8f8ac3714b5f95314", // Nile v3
  "0x2c88A441418E06b9F3e565c2f866Fcb03c9409E2", // Layerbank
  "0x057819bbc15121c923620c27303b2Ed58b87cF86", // Lynex
  "0x7160570BB153Edd0Ea1775EC2b2Ac9b65F1aB61B", // Syncswap
  "0xfDe733b5DE5B5a06C68353e01E4c1D3415C89560", // Pancakeswap
  "0xa05eF29e9aC8C75c530c2795Fa6A800e188dE0a9", // Connext
  "0x62cE247f34dc316f93D3830e4Bf10959FCe630f8", // ZkLink
]);

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
  token_symbol: string;
  usd_price: number;
};

interface BlockData {
  blockNumber: number;
  blockTimestamp: number;
}

const querySize = 500000;
const EZ_ETH_ADDRESS = "0x2416092f143378750bb29b79eD961ab195CcEea5";
const TOKEN_SYMBOL = "EZETH";
const RENZO_INDEXER_INTERFACE =
  "https://app.sentio.xyz/api/v1/analytics/renzo/ezeth-points-linea/sql/execute";
const API_KEY = "XUoNvQW3FCl1MxgdQEyXZhZQZr9bbtm3s";

export const getUserTVLByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = blocks;
  try {
    const response = await fetch(RENZO_INDEXER_INTERFACE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": API_KEY,
      },
      body: JSON.stringify({
        sqlQuery: {
          sql: `WITH RankedByBlockNumber AS (
                    SELECT *,
                           ROW_NUMBER() OVER (PARTITION BY account ORDER BY block_number DESC) AS row_num
                    FROM \`point_update\`
                    WHERE block_number <= ${blockNumber}
                  )
                  SELECT account, newEzETHBalance, block_number, newTimestampMilli, address
                  FROM RankedByBlockNumber
                  WHERE row_num = 1 AND newEzETHBalance > 0
                  `,
          size: querySize,
        },
      }),
    });
    const data = await response.json();
    if (!data.result || !data.result.rows) {
      console.error(`No data found for block ${blockNumber}`);
      return [];
    }
    const csvRows: OutputDataSchemaRow[] = data.result.rows
      .filter((row: any) => !excludedAddresses.has(row.address.toLowerCase()))
      .map((row: any) => ({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: row.account,
        token_address: row.address,
        token_balance: BigInt(row.newEzETHBalance),
        token_symbol: TOKEN_SYMBOL,
        usd_price: 0, // 0 as default
      }));
    return csvRows;
  } catch (error) {
    console.error(`An error occurred for block ${blockNumber}:`, error);
    return [];
  }
};

export const main = async (blocks: BlockData[]) => {
  // Open a write stream for the unified output file.
  const writeStream = fs.createWriteStream("outputData.csv", {
    flags: "w", // 'w' to create a new file or overwrite the existing one.
  });

  const csvFormat = format({
    headers: true,
    includeEndRowDelimiter: true,
    writeHeaders: true,
  });

  csvFormat.pipe(writeStream);

  for (const block of blocks) {
    const csvRows = await getUserTVLByBlock(block);
    console.log(`Processing block: ${block.blockNumber}`);

    // Writing each row to the CSV format stream
    csvRows.forEach((row) => {
      csvFormat.write(row);
    });
  }

  csvFormat.end();

  writeStream.on("finish", () => {
    console.log("CSV file has been written.");
  });
};

// main([
//   { blockNumber: 4452354, blockTimestamp: 123456 },
//   { blockNumber: 3452355, blockTimestamp: 123457 },
// ]);
