import { OutputDataSchemaRow } from "./sdk/types";
import { getTvlByVaultAtBlock } from "./sdk/helpers";
import { addresses } from "./sdk/config";
import { euro3Price } from "./sdk/euro3Price";
import { BlockData } from "./sdk/interfaces";

//* Goal: Hourly snapshot of TVL by User in his Vault.
//* Note: The calculation is made via RPC calls, as there is no way to calculate the TVL via events in our protocol at a block.

export const main = async (blocks: BlockData, logOutput?: boolean) => {
  const { blockNumber, blockTimestamp } = blocks;
  const csvRowsTvl: OutputDataSchemaRow[] = [];

  const euro3Prices = await euro3Price();
  const { owners, tvls } = await getTvlByVaultAtBlock(blockNumber);

  for (let i = 0; i < owners.length; i++) {
    csvRowsTvl.push({
      block_number: blockNumber,
      timestamp: blockTimestamp,
      user_address: owners[i],
      token_address: addresses.euro3,
      token_balance: tvls[i],
      token_symbol: "EURO3",
      usd_price: Number((tvls[i] * euro3Prices.USD).toFixed(2)),
    });
  }

  if (logOutput) console.log(csvRowsTvl);
  return csvRowsTvl;
};

// * Test
// const when = { blockNumber: 3371364, blockTimestamp: 0 };
// main(when, true);
