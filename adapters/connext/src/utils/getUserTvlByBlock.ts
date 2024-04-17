import { parseUnits } from "viem";
import { getCompositeBalances, getLpAccountBalanceAtBlock } from "./subgraph";
import { BlockData, OutputDataSchemaRow } from "./types";

export const getUserTVLByBlock = async (blocks: BlockData): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber } = blocks

  const data = await getLpAccountBalanceAtBlock(blockNumber);

  // get the composite balances
  const composite = await getCompositeBalances(data);

  // format into output
  const results: OutputDataSchemaRow[] = [];
  composite.forEach(({ block, modified, account, underlyingBalances, underlyingTokens }) => {
    results.push(...underlyingBalances.map((b, i) => {
      return {
        timestamp: +modified,
        block_number: +block,
        modified,
        user_address: account.id,
        token_address: underlyingTokens[i],
        token_balance: BigInt(b),
        token_symbol: "",
        usd_price: 0,
      }
    }));
  })

  return results;
};

