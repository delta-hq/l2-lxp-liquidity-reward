import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const V2_SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/59052/lynex-v1/version/latest";
export const GAUGE_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/lynex-gauges/1.1.0/gn";
export const V3_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cltyhthusbmxp01s95k9l8a1u/subgraphs/lynex-cl/v1.0.2/gn";

export const client = createPublicClient({
  chain: linea,
  transport: http("https://rpc.linea.build"),
});

export const PROBLEM_POOLS = {
  '0x8dabf94c7bdd771e448a4ae4794cd71f9f3d7a0d': 0,
} as any;