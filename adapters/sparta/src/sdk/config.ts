import { ApolloClient, InMemoryCache } from "@apollo/client";
import { PoolTokens } from "./types";

export const SPARTA_SUBGRAPH_QUERY_URL =
  "https://api.goldsky.com/api/public/project_clv137yzf5wmt01w2bv2f4cgk/subgraphs/sparta-linea/1/gn";

export const LINEA_RPC = "https://rpc.linea.build";

export const client = new ApolloClient({
  uri: SPARTA_SUBGRAPH_QUERY_URL,
  cache: new InMemoryCache(),
});

// snpashot should be taken every 1 hour, average block time on linea is 11.5 seconds
export const SNAPSHOT_PERIOD_BLOCKS = 311;
export const PROTOCOL_DEPLOY_BLOCK = 3811977;

export const FIRST_TIME = false;

export const POOL_TOKENS: PoolTokens = {
  "0x0460c78bd496ca8e9483e4f0655a28be1e90a89b": {
    token0: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
    token1: "0xa219439258ca9da29e9cc4ce5596924745e12b93",
  },
  "0x30cc8a4f62f1c89bf4246196901e27982be4fd30": {
    token0: "0x11F98c7E42A367DaB4f200d2fdc460fb445CE9a8",
    token1: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
  },
  "0x51a056cc4eb7d1feb896554f97aa01805d41f190": {
    token0: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
    token1: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
  },
  "0x38d4b2627ff87911410129849246a1a19f586873": {
    token0: "0x3aab2285ddcddad8edf438c1bab47e1a9d05a9b4",
    token1: "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f",
  },
  "0x6a4d34cea32ecc5be2fc3ec97ce629f2b4c72334": {
    token0: "0x176211869ca2b568f2a7d4ee941e073a821ee1ff",
    token1: "0x580e933d90091b9ce380740e3a4a39c67eb85b4c",
  },
};
