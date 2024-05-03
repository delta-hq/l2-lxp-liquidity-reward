import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V2_SUBGRAPH_URL = "https://gateway-arbitrum.network.thegraph.com/api/ce0ba3625ebbbd3c4b5a2af394dc8e47/subgraphs/id/3xpZFx5YNWzqemwdtRhyaTXVidKNnjY19XAWoHtvR6Lh"
export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})