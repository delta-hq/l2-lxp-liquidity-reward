// config.ts
import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V3_SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_clu5ow773st3501un98cv0861/subgraphs/TeavaultV3PairLinea-linea/surge/gn";
  
export const client = createPublicClient({
  chain: linea,
  transport: http("https://rpc.linea.build")
})
