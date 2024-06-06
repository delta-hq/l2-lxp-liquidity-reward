import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})

export const okuApiUrl = "https://accounts.icarus.tools"
