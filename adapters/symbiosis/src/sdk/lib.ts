import { SUBGRAPH_URL_VESIS } from "./config";
import { OutputDataSchemaRow, BlockData, UserDeposit } from "./types";

const SIS_TOKEN_LINEA_ADDRESS = "0x6EF95B6f3b0F39508e3E04054Be96D5eE39eDE0d";
const SIS_TOKEN_SYMBOL = "SIS";

export const getUserTVLByBlock = async ({
  blockNumber,
  blockTimestamp,
}: BlockData): Promise<OutputDataSchemaRow[]> => {
  let skip = 0;
  const allDeposits = [];
  const PAGE_SIZE = 1000;

  const query = `
            query ($first: Int!, $skip: Int!, $blockTimestamp: Int!) {
                deposits(first: $first, skip: $skip, where: { locktime_gte: $blockTimestamp }) {
                    locktime
                    provider
                    value
                }
            }
        `;

  while (true) {
    const response = await fetch(SUBGRAPH_URL_VESIS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { skip, first: PAGE_SIZE, blockTimestamp },
      }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error("Failed to fetch deposited users");
    }

    const deposits: OutputDataSchemaRow[] = result.data.deposits.map(
      ({ provider, value }: UserDeposit) => ({
        block_number: blockNumber,
        timestamp: blockTimestamp,
        user_address: provider,
        token_address: SIS_TOKEN_LINEA_ADDRESS,
        token_balance: BigInt(value),
        token_symbol: SIS_TOKEN_SYMBOL,
      })
    );
    allDeposits.push(...deposits);

    // this is last page with data, exit
    if (deposits.length < PAGE_SIZE) {
      break;
    }

    skip += PAGE_SIZE;
  }

  const mergedDepositsMap = allDeposits.reduce((acc, cur) => {
    const { user_address, token_balance } = cur;

    acc[user_address] = {
      ...cur,
      token_balance:
        BigInt(acc[user_address]?.token_balance ?? "0") + token_balance,
    };

    return acc;
  }, {} as Record<string, OutputDataSchemaRow>);

  return Object.values(mergedDepositsMap);
};
