import BigNumber from "bignumber.js";
import {
  getAllV3Positions,
  getAllV3Share,
  getPoolPosition,
  getToken0And1
} from "./v3query";
import { NILE_START_BLOCK } from "./utils";

const NILE_AGETH_RSETH_POOL = "0x6d1ff6a6ea1b54dacd9609949593e7244aea8a4c";

const NILE_SUBGRAPH_BY_DEPLOY_ID =
  "https://api.thegraph.com/subgraphs/id/QmPWcLm9K92GkSwD4UtikFqpHbrHgC2tRMUEiaZ8B7p2Xb";

export async function getNileAgEthHodlers(lineaBlockNumber: number) {
  if (lineaBlockNumber < NILE_START_BLOCK) {
    return [];
  }

  const balances = await getAllV3Share(
    lineaBlockNumber,
    NILE_SUBGRAPH_BY_DEPLOY_ID,
    NILE_AGETH_RSETH_POOL
  );

  return balances;
}
