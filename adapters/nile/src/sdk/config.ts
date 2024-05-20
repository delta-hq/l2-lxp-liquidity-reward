import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_clsz7bxuh5rj401vagtp8a5f9/subgraphs/nile-minimal/prod/gn";

export const client = createPublicClient({
  chain: linea,
  transport: http("https://rpc.linea.build", {
    retryCount: 5,
    timeout: 60_000,
  }),
});
