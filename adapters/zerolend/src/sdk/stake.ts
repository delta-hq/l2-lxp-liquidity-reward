import { BlockData, IOmniStakingData, IOmniStakingResponse, OutputDataSchemaRow } from "./types";

const queryURL =
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/zerolend-omnistaking/1.0.2/gn";

const tokenAddress = "0x78354f8dccb269a615a7e0a24f9b0718fdc3c7a7"; //do we need to convert the case
const symbol = "ZERO";

export const getUserStakeByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = blocks.blockTimestamp;
  const first = 1000;
  const rows: OutputDataSchemaRow[] = [];

  let lastAddress = "0x0000000000000000000000000000000000000000";

  do {
    const query = `{
            tokenBalances(
                where: {id_gt: "${lastAddress}", balance_omni_gt: "0"}
                first: ${first}
              ) {
                id
                balance_omni
              }
      }`;

    const response = await fetch(queryURL, {
      method: "POST",
      body: JSON.stringify({ query }),
      headers: { "Content-Type": "application/json" },
    });
    const batch: IOmniStakingResponse = await response.json();

    if (!batch.data || batch.data.tokenBalances.length == 0) break;

    batch.data.tokenBalances.forEach((data: IOmniStakingData) => {
      rows.push({
        block_number: blocks.blockNumber,
        timestamp,
        user_address: data.id,
        token_address: tokenAddress,
        token_balance: Number(data.balance_omni),
        token_symbol: symbol,
        usd_price: 0,
      });

      lastAddress = data.id;
    });

    console.log(
      `Processed ${rows.length} rows. Last address is ${lastAddress}`
    );
  } while (true);

  return rows;
};
