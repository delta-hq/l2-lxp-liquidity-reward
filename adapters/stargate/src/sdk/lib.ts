import { Readable } from "stream";
import { SUBGRAPH_URL, client } from "./config";
import { Position } from "./types";

const WHITELISTED_TOKEN_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export const getTimestampAtBlock = async (blockNumber: number) => {
  const block = await client.getBlock({
    blockNumber: BigInt(blockNumber),
  });
  return Number(block.timestamp * 1000n);
};

export class PositionsStream extends Readable {
  skip: string;

  constructor(private block: { blockNumber: number; blockTimestamp: number }) {
    super({ objectMode: true });
    this.skip = "0";
  }

  async _read() {
    const query = `
      query {
        farmPositions(
          first: 1000,
          where: { id_gt: ${JSON.stringify(this.skip)}, balance_gt: 0 },
          block: { number: ${this.block.blockNumber} },
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
    const { blockNumber, blockTimestamp } = this.block;

    const rows = farmPositions.map((position: Position) =>
      [
        blockNumber,
        blockTimestamp,
        position.user,
        WHITELISTED_TOKEN_ADDRESS,
        BigInt(position.balance),
        "",
        0,
      ].join(",")
    );

    if (rows.length) {
      this.push(rows.join("\n"));
      this.push("\n");
      this.skip = farmPositions.at(-1).id;
    } else {
      this.push(null);
    }
  }
}
