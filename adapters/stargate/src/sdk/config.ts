import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const POSITIONS_V1_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/72458/linea-balances/version/latest";
export const POSITIONS_V2_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/85232/linea-balances-v2/version/latest";

export const client = createPublicClient({
  chain: linea,
  transport: http(`https://rpc.linea.build`, {
    retryCount: 5,
    timeout: 60_000,
  }),
});
