import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const V2_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/lynex-v1/1.0.4/gn";
export const GAUGE_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/lynex-gauges/1.2.4/gn";
export const V3_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/lynex-cl/v1.0.2/gn";

export const client = createPublicClient({
  chain: linea,
  transport: http(`https://linea-mainnet.infura.io/v3/${process.env.OPENBLOCK_LINEA_INFURA_API_KEY2}`, {
    retryCount: 5,
    timeout: 60_000,
  }),
});

export const PROBLEM_POOLS = {
  '0x8dabf94c7bdd771e448a4ae4794cd71f9f3d7a0d': 0,
} as any;