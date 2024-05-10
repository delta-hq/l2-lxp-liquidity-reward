import { SUBGRAPH_URL, client } from "./config";
import { Position } from "./types";

export const getUserBalancesAtBlock = async (blockNumber: number) => {
  const result: Position[] = [];

  let skip = 0;
  let fetchNext = true;

  while (fetchNext) {
    const query = `
      query {
        farmPositions(
          first: 1000,
          where: { id_gt: ${JSON.stringify(skip)}, balance_gt: 0 },
          block: { number: ${blockNumber} },
          orderBy: id
        ) {
            id
            farm
            user
            lpToken
            balance
        }
      }`;

    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });

    const { data } = await response.json();
    const { farmPositions } = data;

    result.push(...farmPositions);
    if (farmPositions.length < 1000) {
      fetchNext = false;
    } else {
      skip = farmPositions.at(-1).id;
    }
  }

  return result;
};

export const getTimestampAtBlock = async (blockNumber: number) => {
  const block = await client.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};
