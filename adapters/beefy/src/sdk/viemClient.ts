import { createPublicClient, http } from "viem";
import { linea } from "viem/chains";

export const RPC_URLS =
  process.env.RPC_URLS ?? "https://rpc.linea.build,https://rpc.linea.build";

export const clients = RPC_URLS.split(",").map((url) =>
  createPublicClient({
    chain: linea,
    transport: http(url),
    batch: {
      multicall: true,
    },
  })
);

export type BeefyViemClient = (typeof clients)[0];
