import {createPublicClient, http} from "viem";
import {linea} from "viem/chains"

export const SUBGRAPH_URL = "https://graph.myx.finance/subgraphs/name/myx-subgraph-linea"

export const POOL_ADDRESS = "0x03f61a185efEEEFdd3Ba032AFa8A0259337CEd64";

export const client = createPublicClient({
    chain: linea,
    transport: http("https://rpc.linea.build")
})