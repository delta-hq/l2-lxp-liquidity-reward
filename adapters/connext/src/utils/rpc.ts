import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";
import { config } from "dotenv";

export const getClient = () => {
    config();
    return createPublicClient({ chain: linea, transport: http(process.env.CONNEXT_LINEA_RPC) });
}