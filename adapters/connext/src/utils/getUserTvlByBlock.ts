import { getBlock, getCompositeBalances, getLpAccountBalanceAtBlock } from "./subgraph";
import { BlockData, OutputDataSchemaRow } from "./types";

export const getUserTVLByBlock = async (blocks: BlockData): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber } = blocks

  const data = await getLpAccountBalanceAtBlock(blockNumber);

  // get the composite balances
  const composite = await getCompositeBalances(data);

  // get block info
  const { timestamp } = await getBlock(blockNumber);

  // format into output
  const results: OutputDataSchemaRow[] = [];
  composite.forEach(({ account, underlyingBalances, underlyingTokens }) => {
    results.push(...underlyingBalances.map((b, i) => {
      const formatted: OutputDataSchemaRow = {
        timestamp: +timestamp.toString(),
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

