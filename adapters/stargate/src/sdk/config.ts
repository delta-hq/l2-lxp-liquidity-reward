import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/72458/linea-balances/version/latest";

export const client = createPublicClient({
  chain: linea,
  transport: http("https://rpc.linea.build"),
});
