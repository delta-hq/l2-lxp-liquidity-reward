import { createPublicClient, http } from 'viem';
import { linea } from 'viem/chains';

export const V3_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/45376/exchange-v3-linea/version/latest';

  export const VFAT_SUBGRAPH_URL =
  'https://graph.vf.at/subgraphs/name/sickle';

export const client = createPublicClient({
  chain: linea,
  transport: http('https://rpc.linea.build'),
});
