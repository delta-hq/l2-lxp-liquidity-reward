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
      const formatted: OutputDataSchemaRow = {
        timestamp: +modified, // last modified, modified on transfer events
        block_number: blockNumber,
        user_address: account.id,
        token_address: underlyingTokens[i],
        token_balance: BigInt(b),
        token_symbol: "",
        usd_price: 0,
      }
      return formatted;
    }));
  })

  return results;
};

