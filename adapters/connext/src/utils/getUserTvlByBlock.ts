import { parseUnits } from "viem";
import { getLpAccountBalanceAtBlock } from "./subgraph";
import { BlockData, OutputDataSchemaRow } from "./types";

export const getUserTVLByBlock = async (blocks: BlockData): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber } = blocks

  const data = await getLpAccountBalanceAtBlock(blockNumber);

  return data.map(d => {
    return {
      block_number: +d.block,
      timestamp: +d.modified,
      user_address: d.account.id,
      token_address: d.token.id,
      token_balance: BigInt(parseUnits(d.amount, 18)),
      token_symbol: d.token.symbol,
      usd_price: 0
    }
  })
};

