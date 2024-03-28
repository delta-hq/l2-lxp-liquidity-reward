import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V2_SUBGRAPH_URL = "https://graph-query.linea.build/subgraphs/name/sushiswap/sushiswap-linea"
export const V3_SUBGRAPH_URL = "https://graph-query.linea.build/subgraphs/name/sushi-v3/v3-linea"

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})