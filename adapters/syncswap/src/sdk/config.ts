import { createPublicClient, http } from "viem";
import { linea } from "viem/chains"

export const V2_SUBGRAPH_URL = "https://gateway-arbitrum.network.thegraph.com/api/06a21853c18afff683a7ff52c764d434/subgraphs/id/3xpZFx5YNWzqemwdtRhyaTXVidKNnjY19XAWoHtvR6Lh"

export const V2_SUBGRAPH_URL_AFTER_4515693 = "https://gateway-arbitrum.network.thegraph.com/api/06a21853c18afff683a7ff52c764d434/subgraphs/id/9R6uvVYXn9V1iAxkTLXL1Ajka75aD7mmHRj86DbXnyYQ"

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})