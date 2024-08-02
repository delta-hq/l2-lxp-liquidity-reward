import { formatRouterLiquidityEvents, getRouterBalanceAtBlock } from "./cartographer";
import { getLpAccountBalanceAtBlock } from "./subgraph";
import { BlockData, OutputDataSchemaRow } from "./types";
import { getCompositeBalances } from "./assets";

export const getUserTVLByBlock = async (blocks: BlockData): Promise<OutputDataSchemaRow[]> => {
  const { blockNumber, blockTimestamp } = blocks

  const amms = await getLpAccountBalanceAtBlock(blockNumber);


  // get the composite balances
  const composite = await getCompositeBalances(amms);

  // format into output
  const results: OutputDataSchemaRow[] = [];
  // format amm lps
  composite.forEach(({ account, underlyingBalances, underlyingTokens }) => {
    results.push(...underlyingBalances.map((b, i) => {
      const formatted: OutputDataSchemaRow = {
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: account.id,
        token_address: underlyingTokens[i],
        token_balance: BigInt(b),
        token_symbol: "",
        usd_price: 0,
      }
      return formatted;
    }));
  })

  // get the router balances
  const routers = await getRouterBalanceAtBlock(blockNumber);
  const formatted = await formatRouterLiquidityEvents(blocks, routers);

  return results.concat(formatted);
};

