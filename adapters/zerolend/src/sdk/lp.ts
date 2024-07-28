import {
  BlockData,
  IOmniStakingData,
  IOmniStakingResponse,
  OutputDataSchemaRow,
} from "./types";

const queryURL =
  "https://api.goldsky.com/api/public/project_clsk1wzatdsls01wchl2e4n0y/subgraphs/zerolend-omnistaking/1.0.2/gn";

const tokenAddress = "0x78354f8DcCB269a615A7e0a24f9B0718FDC3C7A7"; //do we need to convert the case
const symbol = "ZERO";

export const getUserLPByBlock = async (
  blocks: BlockData
): Promise<OutputDataSchemaRow[]> => {
  const timestamp = blocks.blockTimestamp;
  const first = 1000;
  const rows: OutputDataSchemaRow[] = [];

  let lastAddress = "0x0000000000000000000000000000000000000000";

  do {
    const query = `{
      tokenBalances(
        where: {id_gt: "${lastAddress}", balance_omni_lp_gt: "0"}
        first: ${first}
      ) {
        id
        balance_omni_lp
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
        token_balance: Math.floor(Number(data.balance_omni_lp) / 1e18),
        token_symbol: symbol,
        usd_price: 0,
      });

      lastAddress = data.id;
    });

    console.log(
      `Processed ${rows.length} rows for DLP stakers. Last address is ${lastAddress}`
    );
  } while (true);

  return rows.filter((r) => r.token_balance > 1);
};
