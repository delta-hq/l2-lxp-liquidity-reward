import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V2_SUBGRAPH_URL = "https://gateway-arbitrum.network.thegraph.com/api/06a21853c18afff683a7ff52c764d434/deployments/id/QmT8aCpWka6j2maHmedHQGtu13ru6tx7avsT8Y9tNYrP7s"

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})