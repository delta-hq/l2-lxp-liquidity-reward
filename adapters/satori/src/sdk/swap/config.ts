import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V2_SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_clw1so6mrsn6o01uafow40xlo/subgraphs/satori-linea-dex/0.0.1/gn"

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})