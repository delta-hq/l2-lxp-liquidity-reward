import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V2_SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_clv8dew05klwv01y3cj5scdev/subgraphs/Elk-linea/1.0/gn"
export const V3_SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_clv8dew05klwv01y3cj5scdev/subgraphs/Elk-linea/1.0/gn"

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})