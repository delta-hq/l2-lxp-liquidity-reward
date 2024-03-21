import fs from "fs";
import { write } from "fast-csv";

type OutputDataSchemaRow = {
  block_number: number;
  timestamp: number;
  user_address: string;
  token_address: string;
  token_balance: bigint;
};

type Position = {
  user: string;
  bToken: string;
  bAmount: bigint;
  tokenB0: string;
  b0Amount: bigint;
};

const LINEA_RPC = "https://rpc.linea.build";

const DERI_SUBGRAPH_QUERY_URL = "https://v4dh.deri.io/graphql";

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

const getLatestBlockNumberAndTimestamp = async () => {
  const data = await post(LINEA_RPC, {
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber",
    params: ["latest", false],
    id: 1,
  });
  const blockNumber = parseInt(data.result.number);
  const blockTimestamp = parseInt(data.result.timestamp);
  return { blockNumber, blockTimestamp };
};

const getLTokenPositions = async (blockNumber: number): Promise<Position[]> => {
  let skip = 0;
  let fetchNext = true;
  let result: Position[] = [];
  while (fetchNext) {
    let query = `{
            lTokenPositions(where: {blockNumber: ${blockNumber}, first: 5000, skip:${skip}}) {
              user
              bToken
              tokenB0
              bAmount
              b0Amount
            }
          }`;

    let response = await fetch(DERI_SUBGRAPH_QUERY_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let positions = data.data.lTokenPositions;
    for (let i = 0; i < positions.length; i++) {
      let position = positions[i];
      result.push(position);
    }
    if (positions.length < 5000) {
      fetchNext = false;
    } else {
      skip += 5000;
    }
  }
  return result;
};

const getPTokenPositions = async (blockNumber: number): Promise<Position[]> => {
  let skip = 0;
  let fetchNext = true;
  let result: Position[] = [];
  while (fetchNext) {
    let query = `{
            pTokenPositions(where: {blockNumber: ${blockNumber}, first: 5000, skip:${skip}}) {
              user
              bToken
              tokenB0
              bAmount
              b0Amount
            }
          }`;

    let response = await fetch(DERI_SUBGRAPH_QUERY_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    let data = await response.json();
    let positions = data.data.pTokenPositions;
    for (let i = 0; i < positions.length; i++) {
      let position = positions[i];
      result.push(position);
    }
    if (positions.length < 5000) {
      fetchNext = false;
    } else {
      skip += 5000;
    }
  }
  return result;
};

function convertPositionsToCsvRows(
  positions: Position[],
  blockNumber: number,
  blockTimestamp: number
): OutputDataSchemaRow[] {
  const mergedRowsMap = new Map<string, OutputDataSchemaRow>();

  positions.forEach((position) => {
    const bAmount = BigInt(position.bAmount);
    const b0Amount = BigInt(position.b0Amount);
    if (bAmount > BigInt(0)) {
      const key = `${position.user}-${position.bToken}`;
      const existingRow = mergedRowsMap.get(key);

      if (existingRow) {
        mergedRowsMap.set(key, {
          ...existingRow,
          token_balance: existingRow.token_balance + bAmount,
        });
      } else {
        mergedRowsMap.set(key, {
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: position.user,
          token_address: position.bToken,
          token_balance: bAmount,
        });
      }
    }

    if (b0Amount > BigInt(0)) {
      const keyB0 = `${position.user}-${position.tokenB0}`;
      const existingRowB0 = mergedRowsMap.get(keyB0);

      if (existingRowB0) {
        mergedRowsMap.set(keyB0, {
          ...existingRowB0,
          token_balance: existingRowB0.token_balance + b0Amount,
        });
      } else {
        mergedRowsMap.set(keyB0, {
          block_number: blockNumber,
          timestamp: blockTimestamp,
          user_address: position.user,
          token_address: position.tokenB0,
          token_balance: b0Amount,
        });
      }
    }
  });

  return Array.from(mergedRowsMap.values());
}

const main = async () => {
  const { blockNumber, blockTimestamp } =
    await getLatestBlockNumberAndTimestamp();
  const lTokenPositions = await getLTokenPositions(blockNumber);
  const pTokenPositions = await getPTokenPositions(blockNumber);
  const csvRows = convertPositionsToCsvRows(
    lTokenPositions.concat(pTokenPositions),
    blockNumber,
    blockTimestamp
  );

  // Write the CSV output to a file
  const ws = fs.createWriteStream("outputData.csv");
  write(csvRows, { headers: true })
    .pipe(ws)
    .on("finish", () => {
      console.log("CSV file has been written.");
    });
};

main().then(() => {
  console.log("Done");
});
