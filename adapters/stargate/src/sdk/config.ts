import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const POSITIONS_V1_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/72458/linea-balances/version/latest";
export const POSITIONS_V2_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/85232/linea-balances-v2/version/latest";

export const client = createPublicClient({
  chain: linea,
  transport: http(`https://linea-mainnet.infura.io/v3/${process.env.OPENBLOCK_LINEA_INFURA_API_KEY}`, {
    retryCount: 5,
    timeout: 60_000,
  }),
});
