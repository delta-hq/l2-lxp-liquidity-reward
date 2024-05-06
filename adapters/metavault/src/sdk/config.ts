import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V2_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/55804/linea-v2/version/latest"
export const V3_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/55804/linea-v3/version/latest"
export const TRADE_SUBGRAPH_URL = "https://api.studio.thegraph.com/query/55804/linea-trade/version/latest"

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})