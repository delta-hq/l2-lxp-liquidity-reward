import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const HORIZON_SUBGRAPH_URL = "https://subgraph-mainnet.horizondex.io/subgraphs/name/horizondex/horizondex-mainnet"
export const HORIZON_V2_SUBGRAPH_URL = "https://graph-v2.horizondex.io/subgraphs/name/cryptoalgebra/analytics-2"

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})
