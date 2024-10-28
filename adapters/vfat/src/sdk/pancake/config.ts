import { createPublicClient, http } from 'viem';
import { linea } from 'viem/chains';

export const V3_SUBGRAPH_URL =
  'https://api.studio.thegraph.com/query/45376/exchange-v3-linea/version/latest';  // pancake

export const SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_clsz7bxuh5rj401vagtp8a5f9/subgraphs/nile-minimal/prod/gn"; // nile

export const VFAT_SUBGRAPH_URL =
  'https://graph.vf.at/subgraphs/name/sickle'; // vfat.io

export const client = createPublicClient({
  chain: linea,
  transport: http(process.env.OPENBLOCK_LINEA_INFURA_RPC_URL),
});
