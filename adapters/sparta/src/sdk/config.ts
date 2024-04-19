import { ApolloClient, InMemoryCache } from "@apollo/client";

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

export const FIRST_TIME = true;
